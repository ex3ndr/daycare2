import Fastify from "fastify";
import type { ApiContext } from "../../lib/apiContext.js";
import { ApiError } from "../../lib/apiError.js";
import { apiResponseFail } from "../../lib/apiResponseFail.js";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../lib/authContextResolve.js", () => ({
  authContextResolve: vi.fn()
}));

vi.mock("../../lib/chatMembershipEnsure.js", () => ({
  chatMembershipEnsure: vi.fn()
}));

vi.mock("../../lib/chatRecipientIdsResolve.js", () => ({
  chatRecipientIdsResolve: vi.fn()
}));

vi.mock("../../lib/organizationRecipientIdsResolve.js", () => ({
  organizationRecipientIdsResolve: vi.fn()
}));

vi.mock("../../lib/idempotencyGuard.js", () => ({
  idempotencyGuard: vi.fn((request: unknown, context: unknown, subject: unknown, handler: () => Promise<unknown>) => handler())
}));

import { authContextResolve } from "../../lib/authContextResolve.js";
import { chatMembershipEnsure } from "../../lib/chatMembershipEnsure.js";
import { chatRecipientIdsResolve } from "../../lib/chatRecipientIdsResolve.js";
import { organizationRecipientIdsResolve } from "../../lib/organizationRecipientIdsResolve.js";
import { channelRoutesRegister } from "./channelRoutesRegister.js";

function appCreate(context: ApiContext) {
  const app = Fastify();
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) {
      return reply.status(error.statusCode).send(apiResponseFail(error.code, error.message, error.details));
    }
    return reply.status(500).send(apiResponseFail("INTERNAL_ERROR", "Unexpected server error"));
  });
  void channelRoutesRegister(app, context);
  return app;
}

describe("channelRoutesRegister", () => {
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
});
