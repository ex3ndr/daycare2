import Fastify from "fastify";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { ApiError } from "@/apps/api/lib/apiError.js";
import { apiResponseFail } from "@/apps/api/lib/apiResponseFail.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/apps/api/lib/authContextResolve.js", () => ({
  authContextResolve: vi.fn()
}));

vi.mock("@/apps/api/lib/chatMembershipEnsure.js", () => ({
  chatMembershipEnsure: vi.fn()
}));

vi.mock("@/apps/api/lib/chatRecipientIdsResolve.js", () => ({
  chatRecipientIdsResolve: vi.fn()
}));

vi.mock("@/apps/api/lib/organizationRecipientIdsResolve.js", () => ({
  organizationRecipientIdsResolve: vi.fn()
}));

vi.mock("@/apps/api/lib/idempotencyGuard.js", () => ({
  idempotencyGuard: vi.fn((request: unknown, context: unknown, subject: unknown, handler: () => Promise<unknown>) => handler())
}));

import { authContextResolve } from "@/apps/api/lib/authContextResolve.js";
import { chatMembershipEnsure } from "@/apps/api/lib/chatMembershipEnsure.js";
import { chatRecipientIdsResolve } from "@/apps/api/lib/chatRecipientIdsResolve.js";
import { organizationRecipientIdsResolve } from "@/apps/api/lib/organizationRecipientIdsResolve.js";
import { channelRoutesRegister } from "./channelRoutesRegister.js";

type TransactionRunner<DB extends object> = {
  $transaction: <T>(fn: (tx: DB) => Promise<T>) => Promise<T>;
};

function dbWithTransaction<DB extends object>(db: DB): DB & TransactionRunner<DB> {
  return {
    ...db,
    $transaction: async <T>(fn: (tx: DB) => Promise<T>) => fn(db)
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
  void channelRoutesRegister(app, appContext);
  return app;
}

describe("channelRoutesRegister", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates or opens a direct chat", async () => {
    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "user-1", organizationId: "org-1" } as any
    });

    const context = {
      db: {
        user: {
          findFirst: vi.fn().mockResolvedValue({ id: "user-2" })
        },
        chat: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({
            id: "dm-1",
            organizationId: "org-1",
            createdByUserId: "user-1",
            kind: "DIRECT",
            visibility: "PRIVATE",
            directKey: "user-1:user-2",
            name: null,
            topic: null,
            createdAt: new Date("2026-02-11T00:00:00.000Z"),
            updatedAt: new Date("2026-02-11T00:00:00.000Z"),
            archivedAt: null
          })
        },
        chatMember: {
          findUnique: vi.fn()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null),
          create: vi.fn().mockResolvedValue({ id: "member-1" }),
          update: vi.fn().mockResolvedValue({ id: "member-1" })
        }
      },
      updates: {
        publishToUsers: vi.fn().mockResolvedValue(undefined)
      }
    } as unknown as ApiContext;

    const app = appCreate(context);
    const response = await app.inject({
      method: "POST",
      url: "/api/org/org-1/directs",
      headers: {
        authorization: "Bearer token"
      },
      payload: {
        userId: "user-2"
      }
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as any;
    expect(payload.data.channel.id).toBe("dm-1");
    expect(payload.data.channel.kind).toBe("direct");
    expect(context.updates.publishToUsers).toHaveBeenCalled();

    await app.close();
  });

  it("rejects self direct chat creation", async () => {
    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "user-1", organizationId: "org-1" } as any
    });

    const context = {
      db: {
        user: { findFirst: vi.fn() },
        chat: { findUnique: vi.fn(), create: vi.fn() },
        chatMember: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() }
      },
      updates: {
        publishToUsers: vi.fn().mockResolvedValue(undefined)
      }
    } as unknown as ApiContext;

    const app = appCreate(context);
    const response = await app.inject({
      method: "POST",
      url: "/api/org/org-1/directs",
      headers: {
        authorization: "Bearer token"
      },
      payload: {
        userId: "user-1"
      }
    });

    expect(response.statusCode).toBe(400);

    await app.close();
  });

  it("lists direct chats for current user", async () => {
    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "user-1", organizationId: "org-1" } as any
    });

    const context = {
      db: {
        chatMember: {
          findMany: vi.fn().mockResolvedValue([{
            chat: {
              id: "dm-1",
              organizationId: "org-1",
              createdByUserId: "user-1",
              kind: "DIRECT",
              visibility: "PRIVATE",
              directKey: "user-1:user-2",
              name: null,
              topic: null,
              createdAt: new Date("2026-02-11T00:00:00.000Z"),
              updatedAt: new Date("2026-02-11T00:00:00.000Z"),
              archivedAt: null,
              members: [{
                user: {
                  id: "user-2",
                  kind: "HUMAN",
                  username: "bob",
                  firstName: "Bob",
                  lastName: null,
                  avatarUrl: null
                }
              }]
            }
          }])
        }
      }
    } as unknown as ApiContext;

    const app = appCreate(context);
    const response = await app.inject({
      method: "GET",
      url: "/api/org/org-1/directs",
      headers: {
        authorization: "Bearer token"
      }
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as any;
    expect(payload.data.directs).toHaveLength(1);
    expect(payload.data.directs[0]?.channel.id).toBe("dm-1");
    expect(payload.data.directs[0]?.otherUser.username).toBe("bob");

    await app.close();
  });

  it("lists channels", async () => {
    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "user-1", organizationId: "org-1" } as any
    });

    const context = {
      db: {
        chat: {
          findMany: vi.fn().mockResolvedValue([{
            id: "chat-1",
            organizationId: "org-1",
            name: "general",
            topic: null,
            visibility: "PUBLIC",
            createdAt: new Date("2026-02-10T00:00:00.000Z"),
            updatedAt: new Date("2026-02-10T00:00:00.000Z")
          }])
        }
      }
    } as unknown as ApiContext;

    const app = appCreate(context);
    const response = await app.inject({
      method: "GET",
      url: "/api/org/org-1/channels",
      headers: {
        authorization: "Bearer token"
      }
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as any;
    expect(payload.ok).toBe(true);
    expect(payload.data.channels).toHaveLength(1);

    await app.close();
  });

  it("creates a channel", async () => {
    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "user-1", organizationId: "org-1" } as any
    });
    vi.mocked(organizationRecipientIdsResolve).mockResolvedValue(["user-1"]);

    const context = {
      db: {
        chat: {
          create: vi.fn().mockResolvedValue({
            id: "chat-1",
            organizationId: "org-1",
            name: "general",
            topic: null,
            visibility: "PUBLIC",
            createdAt: new Date("2026-02-10T00:00:00.000Z"),
            updatedAt: new Date("2026-02-10T00:00:00.000Z")
          })
        }
      },
      updates: {
        publishToUsers: vi.fn().mockResolvedValue(undefined)
      }
    } as unknown as ApiContext;

    const app = appCreate(context);
    const response = await app.inject({
      method: "POST",
      url: "/api/org/org-1/channels",
      headers: {
        authorization: "Bearer token"
      },
      payload: {
        name: "general",
        visibility: "public"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(context.updates.publishToUsers).toHaveBeenCalled();

    await app.close();
  });

  it("updates a channel", async () => {
    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "user-1", organizationId: "org-1" } as any
    });
    vi.mocked(chatMembershipEnsure).mockResolvedValue({ id: "membership-1" } as any);
    vi.mocked(chatRecipientIdsResolve).mockResolvedValue(["user-1"]);

    const context = {
      db: {
        chat: {
          findFirst: vi.fn().mockResolvedValue({ id: "chat-1" }),
          update: vi.fn().mockResolvedValue({
            id: "chat-1",
            organizationId: "org-1",
            name: "general",
            topic: "topic",
            visibility: "PUBLIC",
            createdAt: new Date("2026-02-10T00:00:00.000Z"),
            updatedAt: new Date("2026-02-10T00:00:00.000Z")
          })
        }
      },
      updates: {
        publishToUsers: vi.fn().mockResolvedValue(undefined)
      }
    } as unknown as ApiContext;

    const app = appCreate(context);
    const response = await app.inject({
      method: "PATCH",
      url: "/api/org/org-1/channels/chat-1",
      headers: {
        authorization: "Bearer token"
      },
      payload: {
        topic: "topic"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(context.updates.publishToUsers).toHaveBeenCalled();

    await app.close();
  });

  it("joins and leaves a channel", async () => {
    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "user-1", organizationId: "org-1" } as any
    });
    vi.mocked(chatRecipientIdsResolve).mockResolvedValue(["user-1"]);

    const context = {
      db: {
        chat: {
          findFirst: vi.fn().mockResolvedValue({
            id: "chat-1",
            organizationId: "org-1",
            kind: "CHANNEL",
            visibility: "PUBLIC"
          })
        },
        chatMember: {
          findFirst: vi.fn()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({
              id: "membership-1",
              chatId: "chat-1",
              userId: "user-1",
              role: "MEMBER",
              notificationLevel: "ALL",
              joinedAt: new Date("2026-02-10T00:00:00.000Z"),
              leftAt: null
            }),
          create: vi.fn().mockResolvedValue({
            id: "membership-1",
            chatId: "chat-1",
            userId: "user-1",
            role: "MEMBER",
            notificationLevel: "ALL",
            joinedAt: new Date("2026-02-10T00:00:00.000Z"),
            leftAt: null
          }),
          update: vi.fn().mockResolvedValue({
            id: "membership-1",
            chatId: "chat-1",
            userId: "user-1",
            role: "MEMBER",
            notificationLevel: "ALL",
            joinedAt: new Date("2026-02-10T00:00:00.000Z"),
            leftAt: new Date("2026-02-10T00:10:00.000Z")
          })
        }
      },
      updates: {
        publishToUsers: vi.fn().mockResolvedValue(undefined)
      }
    } as unknown as ApiContext;

    const app = appCreate(context);

    const joinResponse = await app.inject({
      method: "POST",
      url: "/api/org/org-1/channels/chat-1/join",
      headers: {
        authorization: "Bearer token"
      }
    });
    expect(joinResponse.statusCode).toBe(200);

    const leaveResponse = await app.inject({
      method: "POST",
      url: "/api/org/org-1/channels/chat-1/leave",
      headers: {
        authorization: "Bearer token"
      }
    });
    expect(leaveResponse.statusCode).toBe(200);

    await app.close();
  });

  it("rejects channel update when channel is missing", async () => {
    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "user-1", organizationId: "org-1" } as any
    });
    vi.mocked(chatMembershipEnsure).mockResolvedValue({ id: "membership-1" } as any);

    const context = {
      db: {
        chat: {
          findFirst: vi.fn().mockResolvedValue(null)
        }
      }
    } as unknown as ApiContext;

    const app = appCreate(context);
    const response = await app.inject({
      method: "PATCH",
      url: "/api/org/org-1/channels/chat-1",
      headers: {
        authorization: "Bearer token"
      },
      payload: {
        name: "general"
      }
    });

    expect(response.statusCode).toBe(404);

    await app.close();
  });

  it("rejects joining a private channel", async () => {
    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "user-1", organizationId: "org-1" } as any
    });

    const context = {
      db: {
        chat: {
          findFirst: vi.fn().mockResolvedValue({
            id: "chat-1",
            organizationId: "org-1",
            kind: "CHANNEL",
            visibility: "PRIVATE"
          })
        }
      }
    } as unknown as ApiContext;

    const app = appCreate(context);
    const response = await app.inject({
      method: "POST",
      url: "/api/org/org-1/channels/chat-1/join",
      headers: {
        authorization: "Bearer token"
      }
    });

    expect(response.statusCode).toBe(403);

    await app.close();
  });

  it("rejoins a channel using historical membership", async () => {
    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "user-1", organizationId: "org-1" } as any
    });
    vi.mocked(chatRecipientIdsResolve).mockResolvedValue(["user-1"]);

    const context = {
      db: {
        chat: {
          findFirst: vi.fn().mockResolvedValue({
            id: "chat-1",
            organizationId: "org-1",
            kind: "CHANNEL",
            visibility: "PUBLIC"
          })
        },
        chatMember: {
          findFirst: vi.fn()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({
              id: "membership-1",
              chatId: "chat-1",
              userId: "user-1",
              role: "MEMBER",
              joinedAt: new Date("2026-02-01T00:00:00.000Z"),
              leftAt: new Date("2026-02-09T00:00:00.000Z")
            }),
          update: vi.fn().mockResolvedValue({
            id: "membership-1",
            chatId: "chat-1",
            userId: "user-1",
            role: "MEMBER",
            joinedAt: new Date("2026-02-10T00:00:00.000Z"),
            leftAt: null
          })
        }
      },
      updates: {
        publishToUsers: vi.fn().mockResolvedValue(undefined)
      }
    } as unknown as ApiContext;

    const app = appCreate(context);
    const response = await app.inject({
      method: "POST",
      url: "/api/org/org-1/channels/chat-1/join",
      headers: {
        authorization: "Bearer token"
      }
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as any;
    expect(payload.data.membership.leftAt).toBeNull();

    await app.close();
  });

  it("returns 404 when leaving without membership", async () => {
    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "user-1", organizationId: "org-1" } as any
    });

    const context = {
      db: {
        chatMember: {
          findFirst: vi.fn().mockResolvedValue(null)
        }
      }
    } as unknown as ApiContext;

    const app = appCreate(context);
    const response = await app.inject({
      method: "POST",
      url: "/api/org/org-1/channels/chat-1/leave",
      headers: {
        authorization: "Bearer token"
      }
    });

    expect(response.statusCode).toBe(404);

    await app.close();
  });

  it("lists channel members", async () => {
    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "user-1", organizationId: "org-1" } as any
    });
    vi.mocked(chatMembershipEnsure).mockResolvedValue({ id: "membership-1" } as any);

    const context = {
      db: {
        chatMember: {
          findMany: vi.fn().mockResolvedValue([{
            chatId: "chat-1",
            userId: "user-1",
            role: "OWNER",
            joinedAt: new Date("2026-02-10T00:00:00.000Z"),
            leftAt: null,
            user: {
              id: "user-1",
              kind: "HUMAN",
              username: "dev",
              firstName: "Dev",
              lastName: null,
              avatarUrl: null
            }
          }])
        }
      }
    } as unknown as ApiContext;

    const app = appCreate(context);
    const response = await app.inject({
      method: "GET",
      url: "/api/org/org-1/channels/chat-1/members",
      headers: {
        authorization: "Bearer token"
      }
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as any;
    expect(payload.ok).toBe(true);
    expect(payload.data.members).toHaveLength(1);

    await app.close();
  });

  it("kicks a channel member", async () => {
    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "owner-1", organizationId: "org-1" } as any
    });
    vi.mocked(chatRecipientIdsResolve).mockResolvedValue(["owner-1"]);

    const context = {
      db: {
        chat: {
          findFirst: vi.fn().mockResolvedValue({ id: "chat-1", organizationId: "org-1", kind: "CHANNEL" })
        },
        chatMember: {
          findFirst: vi.fn()
            .mockResolvedValueOnce({ id: "owner-member", role: "OWNER" })
            .mockResolvedValueOnce({ id: "target-member", role: "MEMBER" }),
          findMany: vi.fn().mockResolvedValue([{ userId: "owner-1" }]),
          update: vi.fn().mockResolvedValue({
            id: "target-member",
            chatId: "chat-1",
            userId: "user-2",
            role: "MEMBER",
            notificationLevel: "ALL",
            joinedAt: new Date("2026-02-10T00:00:00.000Z"),
            leftAt: new Date("2026-02-10T00:10:00.000Z")
          })
        }
      },
      updates: {
        publishToUsers: vi.fn().mockResolvedValue(undefined)
      }
    } as unknown as ApiContext;

    const app = appCreate(context);
    const response = await app.inject({
      method: "POST",
      url: "/api/org/org-1/channels/chat-1/members/user-2/kick",
      headers: {
        authorization: "Bearer token"
      }
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as any;
    expect(payload.data.removed).toBe(true);
    expect(payload.data.membership.userId).toBe("user-2");

    await app.close();
  });

  it("updates a channel member role", async () => {
    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "owner-1", organizationId: "org-1" } as any
    });
    vi.mocked(chatRecipientIdsResolve).mockResolvedValue(["owner-1", "user-2"]);

    const context = {
      db: {
        chat: {
          findFirst: vi.fn().mockResolvedValue({ id: "chat-1", organizationId: "org-1", kind: "CHANNEL" })
        },
        chatMember: {
          findFirst: vi.fn()
            .mockResolvedValueOnce({ id: "owner-member", role: "OWNER" })
            .mockResolvedValueOnce({ id: "target-member", role: "MEMBER" }),
          count: vi.fn().mockResolvedValue(1),
          findMany: vi.fn().mockResolvedValue([{ userId: "owner-1" }, { userId: "user-2" }]),
          update: vi.fn().mockResolvedValue({
            id: "target-member",
            chatId: "chat-1",
            userId: "user-2",
            role: "OWNER",
            notificationLevel: "ALL",
            joinedAt: new Date("2026-02-10T00:00:00.000Z"),
            leftAt: null
          })
        }
      },
      updates: {
        publishToUsers: vi.fn().mockResolvedValue(undefined)
      }
    } as unknown as ApiContext;

    const app = appCreate(context);
    const response = await app.inject({
      method: "PATCH",
      url: "/api/org/org-1/channels/chat-1/members/user-2/role",
      headers: {
        authorization: "Bearer token"
      },
      payload: {
        role: "OWNER"
      }
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as any;
    expect(payload.data.updated).toBe(true);
    expect(payload.data.membership.role).toBe("owner");

    await app.close();
  });
});
