import Fastify from "fastify";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { ApiError } from "@/apps/api/lib/apiError.js";
import { apiResponseFail } from "@/apps/api/lib/apiResponseFail.js";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/apps/api/lib/authContextResolve.js", () => ({
  authContextResolve: vi.fn()
}));

vi.mock("@/apps/api/lib/chatMembershipEnsure.js", () => ({
  chatMembershipEnsure: vi.fn()
}));

vi.mock("@/apps/api/lib/chatRecipientIdsResolve.js", () => ({
  chatRecipientIdsResolve: vi.fn()
}));

vi.mock("@/apps/api/lib/idempotencyGuard.js", () => ({
  idempotencyGuard: vi.fn((request: unknown, context: unknown, subject: unknown, handler: () => Promise<unknown>) => handler())
}));

vi.mock("@/apps/ai/aiBotWebhookDeliver.js", () => ({
  aiBotWebhookDeliver: vi.fn().mockResolvedValue(true)
}));

import { authContextResolve } from "@/apps/api/lib/authContextResolve.js";
import { aiBotWebhookDeliver } from "@/apps/ai/aiBotWebhookDeliver.js";
import { chatMembershipEnsure } from "@/apps/api/lib/chatMembershipEnsure.js";
import { chatRecipientIdsResolve } from "@/apps/api/lib/chatRecipientIdsResolve.js";
import { messageRoutesRegister } from "./messageRoutesRegister.js";

type TransactionRunner<DB extends object> = {
  $transaction: <T>(fn: (tx: DB) => Promise<T>) => Promise<T>;
};

function dbWithTransaction<DB extends object>(db: DB): DB & TransactionRunner<DB> {
  return {
    ...db,
    $transaction: async <T>(fn: (tx: DB) => Promise<T>) => fn(db)
  };
}

type SenderUser = {
  id: string;
  kind: "HUMAN" | "AI";
  username: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
};

type AttachmentRecord = {
  id: string;
  kind: string;
  url: string;
  mimeType: string | null;
  fileName: string | null;
  sizeBytes: number | null;
  sortOrder: number;
};

type ReactionRecord = {
  id: string;
  userId: string;
  shortcode: string;
  createdAt: Date;
};

type MessageRecord = {
  id: string;
  chatId: string;
  senderUserId: string;
  threadId: string | null;
  text: string;
  createdAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
  threadReplyCount: number;
  threadLastReplyAt: Date | null;
  senderUser: SenderUser;
  attachments: AttachmentRecord[];
  reactions: ReactionRecord[];
};

const baseSender: SenderUser = {
  id: "user-1",
  kind: "HUMAN",
  username: "alice",
  firstName: "Alice",
  lastName: "Smith",
  avatarUrl: null
};

function messageMake(overrides: Partial<MessageRecord> = {}): MessageRecord {
  return {
    id: "message-1",
    chatId: "chat-1",
    senderUserId: "user-1",
    threadId: null,
    text: "hello",
    createdAt: new Date("2026-02-10T00:00:00.000Z"),
    editedAt: null,
    deletedAt: null,
    threadReplyCount: 0,
    threadLastReplyAt: null,
    senderUser: baseSender,
    attachments: [],
    reactions: [],
    ...overrides
  };
}

function appCreate(context: ApiContext) {
  const app = Fastify();
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) {
      return reply.status(error.statusCode).send(apiResponseFail(error.code, error.message, error.details));
    }
    return reply.status(500).send(apiResponseFail("INTERNAL_ERROR", "Unexpected server error"));
  });
  const appContext = {
    ...context,
    db: dbWithTransaction(context.db as unknown as Record<string, unknown>)
  } as unknown as ApiContext;
  void messageRoutesRegister(app, appContext);
  return app;
}

describe("messageRoutesRegister", () => {
  it("lists messages around an anchor", async () => {
    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "user-1", organizationId: "org-1" } as any
    });
    vi.mocked(chatMembershipEnsure).mockResolvedValue({ id: "membership-1" } as any);

    const center = messageMake({
      id: "message-center",
      createdAt: new Date("2026-02-10T00:00:10.000Z"),
      attachments: [
        { id: "a2", kind: "image", url: "https://example.com/2", mimeType: "image/png", fileName: "b.png", sizeBytes: 2, sortOrder: 2 },
        { id: "a0", kind: "image", url: "https://example.com/0", mimeType: "image/png", fileName: "a.png", sizeBytes: 1, sortOrder: 0 },
        { id: "a1", kind: "image", url: "https://example.com/1", mimeType: "image/png", fileName: "c.png", sizeBytes: 3, sortOrder: 1 }
      ]
    });
    const before = messageMake({ id: "message-before", createdAt: new Date("2026-02-10T00:00:05.000Z") });
    const after = messageMake({ id: "message-after", createdAt: new Date("2026-02-10T00:00:15.000Z") });

    const context = {
      db: {
        message: {
          findUnique: vi.fn().mockResolvedValue(center),
          findMany: vi.fn()
            .mockResolvedValueOnce([before])
            .mockResolvedValueOnce([center, after])
        }
      }
    } as unknown as ApiContext;

    const app = appCreate(context);
    const response = await app.inject({
      method: "GET",
      url: "/api/org/org-1/channels/chat-1/messages?around=message-center&limit=4",
      headers: {
        authorization: "Bearer token"
      }
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as any;
    const centerPayload = payload.data.messages.find((message: any) => message.id === "message-center");
    expect(centerPayload.sender.kind).toBe("human");
    expect(centerPayload.attachments.map((attachment: any) => attachment.sortOrder)).toEqual([0, 1, 2]);

    await app.close();
  });

  it("returns 404 when around anchor is missing", async () => {
    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "user-1", organizationId: "org-1" } as any
    });
    vi.mocked(chatMembershipEnsure).mockResolvedValue({ id: "membership-1" } as any);

    const context = {
      db: {
        message: {
          findUnique: vi.fn().mockResolvedValue(null)
        }
      }
    } as unknown as ApiContext;

    const app = appCreate(context);
    const response = await app.inject({
      method: "GET",
      url: "/api/org/org-1/channels/chat-1/messages?around=missing",
      headers: {
        authorization: "Bearer token"
      }
    });

    expect(response.statusCode).toBe(404);

    await app.close();
  });

  it("lists newest messages by default", async () => {
    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "user-1", organizationId: "org-1" } as any
    });
    vi.mocked(chatMembershipEnsure).mockResolvedValue({ id: "membership-1" } as any);

    const newest = messageMake({ id: "message-new", createdAt: new Date("2026-02-10T00:00:20.000Z") });
    const older = messageMake({ id: "message-old", createdAt: new Date("2026-02-10T00:00:10.000Z") });

    const context = {
      db: {
        message: {
          findMany: vi.fn().mockResolvedValue([newest, older])
        }
      }
    } as unknown as ApiContext;

    const app = appCreate(context);
    const response = await app.inject({
      method: "GET",
      url: "/api/org/org-1/channels/chat-1/messages",
      headers: {
        authorization: "Bearer token"
      }
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as any;
    expect(payload.data.messages[0].id).toBe("message-old");
    expect(payload.data.messages[1].id).toBe("message-new");

    await app.close();
  });

  it("lists messages before an anchor", async () => {
    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "user-1", organizationId: "org-1" } as any
    });
    vi.mocked(chatMembershipEnsure).mockResolvedValue({ id: "membership-1" } as any);

    const anchor = messageMake({ id: "message-anchor", createdAt: new Date("2026-02-10T00:00:30.000Z") });
    const older = messageMake({ id: "message-old", createdAt: new Date("2026-02-10T00:00:10.000Z") });

    const context = {
      db: {
        message: {
          findUnique: vi.fn().mockResolvedValue(anchor),
          findMany: vi.fn().mockResolvedValue([older])
        }
      }
    } as unknown as ApiContext;

    const app = appCreate(context);
    const response = await app.inject({
      method: "GET",
      url: "/api/org/org-1/channels/chat-1/messages?before=message-anchor",
      headers: {
        authorization: "Bearer token"
      }
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as any;
    expect(payload.data.messages[0].id).toBe("message-old");

    await app.close();
  });

  it("lists messages after an anchor", async () => {
    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "user-1", organizationId: "org-1" } as any
    });
    vi.mocked(chatMembershipEnsure).mockResolvedValue({ id: "membership-1" } as any);

    const anchor = messageMake({ id: "message-anchor", createdAt: new Date("2026-02-10T00:00:10.000Z") });
    const newer = messageMake({ id: "message-new", createdAt: new Date("2026-02-10T00:00:30.000Z") });

    const context = {
      db: {
        message: {
          findUnique: vi.fn().mockResolvedValue(anchor),
          findMany: vi.fn().mockResolvedValue([newer])
        }
      }
    } as unknown as ApiContext;

    const app = appCreate(context);
    const response = await app.inject({
      method: "GET",
      url: "/api/org/org-1/channels/chat-1/messages?after=message-anchor",
      headers: {
        authorization: "Bearer token"
      }
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as any;
    expect(payload.data.messages[0].id).toBe("message-new");

    await app.close();
  });

  it("sends a message with thread and mentions", async () => {
    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "user-1", organizationId: "org-1" } as any
    });
    vi.mocked(chatMembershipEnsure).mockResolvedValue({ id: "membership-1" } as any);
    vi.mocked(chatRecipientIdsResolve).mockResolvedValue(["user-1", "user-2"]);

    const created = messageMake({
      id: "message-new",
      threadId: "thread-1",
      createdAt: new Date("2026-02-10T00:00:40.000Z")
    });

    const userFindMany = vi.fn().mockResolvedValue([
      { id: "user-2", kind: "HUMAN", webhookUrl: null },
      { id: "user-3", kind: "AI", webhookUrl: "https://example.com/bot-webhook" }
    ]);

    const context = {
      db: {
        chat: {
          findFirst: vi.fn().mockResolvedValue({ archivedAt: null, kind: "CHANNEL" })
        },
        message: {
          findFirst: vi.fn().mockResolvedValue({ id: "thread-1", chatId: "chat-1" }),
          create: vi.fn().mockResolvedValue(created),
          update: vi.fn().mockResolvedValue({ id: "thread-1" })
        },
        thread: {
          upsert: vi.fn().mockResolvedValue({ id: "thread-1" })
        },
        user: {
          findMany: userFindMany
        }
      },
      updates: {
        publishToUsers: vi.fn().mockResolvedValue(undefined)
      }
    } as unknown as ApiContext;

    const app = appCreate(context);
    const response = await app.inject({
      method: "POST",
      url: "/api/org/org-1/messages/send",
      headers: {
        authorization: "Bearer token"
      },
      payload: {
        channelId: "chat-1",
        text: "hello @alice @alice @bob",
        threadId: "thread-1",
        attachments: [{
          kind: "image",
          url: "https://example.com/1",
          mimeType: "image/png",
          fileName: "image.png",
          sizeBytes: 12
        }]
      }
    });

    expect(response.statusCode).toBe(200);
    expect(userFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        username: {
          in: ["alice", "bob"]
        }
      })
    }));
    expect(context.updates.publishToUsers).toHaveBeenCalled();
    expect(aiBotWebhookDeliver).toHaveBeenCalledWith(expect.objectContaining({
      webhookUrl: "https://example.com/bot-webhook"
    }));

    await app.close();
  });

  it("does not deliver bot webhooks for AI-authored messages", async () => {
    vi.mocked(aiBotWebhookDeliver).mockClear();
    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "bot-1", organizationId: "org-1" } as any
    });
    vi.mocked(chatMembershipEnsure).mockResolvedValue({ id: "membership-1" } as any);
    vi.mocked(chatRecipientIdsResolve).mockResolvedValue(["bot-1", "user-2"]);

    const created = messageMake({
      id: "message-ai",
      senderUserId: "bot-1",
      senderUser: {
        ...baseSender,
        id: "bot-1",
        kind: "AI",
        username: "helper"
      }
    });

    const context = {
      db: {
        chat: {
          findFirst: vi.fn().mockResolvedValue({ archivedAt: null, kind: "CHANNEL" })
        },
        message: {
          create: vi.fn().mockResolvedValue(created)
        },
        user: {
          findMany: vi.fn().mockResolvedValue([
            { id: "bot-2", kind: "AI", webhookUrl: "https://example.com/bot-webhook" }
          ])
        }
      },
      updates: {
        publishToUsers: vi.fn().mockResolvedValue(undefined)
      }
    } as unknown as ApiContext;

    const app = appCreate(context);
    const response = await app.inject({
      method: "POST",
      url: "/api/org/org-1/messages/send",
      headers: {
        authorization: "Bearer token"
      },
      payload: {
        channelId: "chat-1",
        text: "hello @helper"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(aiBotWebhookDeliver).not.toHaveBeenCalled();
    await app.close();
  });

  it("rejects thread replies when root is missing", async () => {
    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "user-1", organizationId: "org-1" } as any
    });
    vi.mocked(chatMembershipEnsure).mockResolvedValue({ id: "membership-1" } as any);

    const context = {
      db: {
        chat: {
          findFirst: vi.fn().mockResolvedValue({ archivedAt: null, kind: "CHANNEL" })
        },
        message: {
          findFirst: vi.fn().mockResolvedValue(null)
        }
      }
    } as unknown as ApiContext;

    const app = appCreate(context);
    const response = await app.inject({
      method: "POST",
      url: "/api/org/org-1/messages/send",
      headers: {
        authorization: "Bearer token"
      },
      payload: {
        channelId: "chat-1",
        text: "reply",
        threadId: "missing-thread"
      }
    });

    expect(response.statusCode).toBe(404);

    await app.close();
  });

  it("rejects sending to archived channels", async () => {
    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "user-1", organizationId: "org-1" } as any
    });
    vi.mocked(chatMembershipEnsure).mockResolvedValue({ id: "membership-1" } as any);

    const context = {
      db: {
        chat: {
          findFirst: vi.fn().mockResolvedValue({ archivedAt: new Date("2026-02-11T00:00:00.000Z") })
        }
      }
    } as unknown as ApiContext;

    const app = appCreate(context);
    const response = await app.inject({
      method: "POST",
      url: "/api/org/org-1/messages/send",
      headers: {
        authorization: "Bearer token"
      },
      payload: {
        channelId: "chat-1",
        text: "blocked"
      }
    });

    expect(response.statusCode).toBe(403);

    await app.close();
  });

  it("edits a message and updates mentions", async () => {
    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "user-1", organizationId: "org-1" } as any
    });
    vi.mocked(chatMembershipEnsure).mockResolvedValue({ id: "membership-1" } as any);
    vi.mocked(chatRecipientIdsResolve).mockResolvedValue(["user-1"]);

    const existing = messageMake({ id: "message-edit", senderUserId: "user-1" });
    const updated = messageMake({ id: "message-edit", text: "edited @bob" });

    const context = {
      db: {
        message: {
          findUnique: vi.fn().mockResolvedValue(existing),
          update: vi.fn().mockResolvedValue(updated)
        },
        user: {
          findMany: vi.fn().mockResolvedValue([{ id: "user-2" }])
        }
      },
      updates: {
        publishToUsers: vi.fn().mockResolvedValue(undefined)
      }
    } as unknown as ApiContext;

    const app = appCreate(context);
    const response = await app.inject({
      method: "POST",
      url: "/api/org/org-1/messages/message-edit/edit",
      headers: {
        authorization: "Bearer token"
      },
      payload: {
        text: "edited @bob"
      }
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as any;
    expect(payload.data.message.text).toBe("edited @bob");

    await app.close();
  });

  it("blocks message edits by non-authors", async () => {
    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "user-1", organizationId: "org-1" } as any
    });
    vi.mocked(chatMembershipEnsure).mockResolvedValue({ id: "membership-1" } as any);

    const context = {
      db: {
        message: {
          findUnique: vi.fn().mockResolvedValue(messageMake({ id: "message-edit", senderUserId: "user-2" }))
        }
      }
    } as unknown as ApiContext;

    const app = appCreate(context);
    const response = await app.inject({
      method: "POST",
      url: "/api/org/org-1/messages/message-edit/edit",
      headers: {
        authorization: "Bearer token"
      },
      payload: {
        text: "edited"
      }
    });

    expect(response.statusCode).toBe(403);

    await app.close();
  });

  it("deletes a message", async () => {
    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "user-1", organizationId: "org-1" } as any
    });
    vi.mocked(chatMembershipEnsure).mockResolvedValue({ id: "membership-1" } as any);
    vi.mocked(chatRecipientIdsResolve).mockResolvedValue(["user-1"]);

    const context = {
      db: {
        message: {
          findUnique: vi.fn().mockResolvedValue(messageMake({ id: "message-delete", senderUserId: "user-1" })),
          update: vi.fn().mockResolvedValue({ id: "message-delete", chatId: "chat-1" })
        }
      },
      updates: {
        publishToUsers: vi.fn().mockResolvedValue(undefined)
      }
    } as unknown as ApiContext;

    const app = appCreate(context);
    const response = await app.inject({
      method: "POST",
      url: "/api/org/org-1/messages/message-delete/delete",
      headers: {
        authorization: "Bearer token"
      }
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as any;
    expect(payload.data.deleted).toBe(true);

    await app.close();
  });

  it("returns 404 when deleting missing message", async () => {
    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "user-1", organizationId: "org-1" } as any
    });

    const context = {
      db: {
        message: {
          findUnique: vi.fn().mockResolvedValue(null)
        }
      }
    } as unknown as ApiContext;

    const app = appCreate(context);
    const response = await app.inject({
      method: "POST",
      url: "/api/org/org-1/messages/missing/delete",
      headers: {
        authorization: "Bearer token"
      }
    });

    expect(response.statusCode).toBe(404);

    await app.close();
  });

  it("handles reaction add and remove", async () => {
    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "user-1", organizationId: "org-1" } as any
    });
    vi.mocked(chatMembershipEnsure).mockResolvedValue({ id: "membership-1" } as any);
    vi.mocked(chatRecipientIdsResolve).mockResolvedValue(["user-1"]);

    const context = {
      db: {
        message: {
          findUnique: vi.fn().mockResolvedValue(messageMake({ id: "message-reaction", senderUserId: "user-1" }))
        },
        messageReaction: {
          upsert: vi.fn().mockResolvedValue({ id: "reaction-1" }),
          deleteMany: vi.fn().mockResolvedValue({ count: 1 })
        }
      },
      updates: {
        publishToUsers: vi.fn().mockResolvedValue(undefined)
      }
    } as unknown as ApiContext;

    const app = appCreate(context);
    const addResponse = await app.inject({
      method: "POST",
      url: "/api/org/org-1/messages/message-reaction/reactions/add",
      headers: {
        authorization: "Bearer token"
      },
      payload: {
        shortcode: ":wave:"
      }
    });

    expect(addResponse.statusCode).toBe(200);

    const removeResponse = await app.inject({
      method: "POST",
      url: "/api/org/org-1/messages/message-reaction/reactions/remove",
      headers: {
        authorization: "Bearer token"
      },
      payload: {
        shortcode: ":wave:"
      }
    });

    expect(removeResponse.statusCode).toBe(200);

    await app.close();
  });
});
