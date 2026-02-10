import type { FastifyInstance } from "fastify";
import type { ApiContext } from "../../lib/apiContext.js";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../lib/authContextResolve.js", () => ({
  authContextResolve: vi.fn()
}));

vi.mock("../../lib/chatMembershipEnsure.js", () => ({
  chatMembershipEnsure: vi.fn()
}));

import { authContextResolve } from "../../lib/authContextResolve.js";
import { chatMembershipEnsure } from "../../lib/chatMembershipEnsure.js";
import { typingRoutesRegister } from "./typingRoutesRegister.js";

describe("typingRoutesRegister", () => {
  it("stores typing state and broadcasts", async () => {
    const handlers: Record<string, (request: any, reply: any) => Promise<unknown>> = {};
    const app = {
      post: (path: string, handler: (request: any, reply: any) => Promise<unknown>) => {
        handlers[`POST ${path}`] = handler;
      },
      get: (path: string, handler: (request: any, reply: any) => Promise<unknown>) => {
        handlers[`GET ${path}`] = handler;
      }
    } as FastifyInstance;

    const upsert = vi.fn().mockResolvedValue({});
    const findMany = vi.fn().mockResolvedValue([{ userId: "user-1" }]);
    const context = {
      db: {
        chatTypingState: {
          upsert,
          findMany: vi.fn()
        },
        chatMember: {
          findMany
        }
      },
      redis: {
        set: vi.fn().mockResolvedValue("OK")
      },
      updates: {
        publishToUsers: vi.fn().mockResolvedValue(undefined)
      }
    } as unknown as ApiContext;

    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "user-1", organizationId: "org-1" } as any
    });
    vi.mocked(chatMembershipEnsure).mockResolvedValue({ id: "m1" } as any);

    await typingRoutesRegister(app, context);

    const typingPost = handlers["POST /api/org/:orgid/channels/:channelId/typing"];
    if (!typingPost) {
      throw new Error("typing handler not registered");
    }
    const result = await typingPost({
      params: {
        orgid: "org-1",
        channelId: "chat-1"
      },
      body: {
        threadRootMessageId: null
      }
    }, {} as any);

    expect(upsert).toHaveBeenCalled();
    expect(context.redis.set).toHaveBeenCalled();
    expect(context.updates.publishToUsers).toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: true,
      data: {
        ok: true
      }
    });
  });

  it("returns active typing list", async () => {
    const handlers: Record<string, (request: any, reply: any) => Promise<unknown>> = {};
    const app = {
      post: (path: string, handler: (request: any, reply: any) => Promise<unknown>) => {
        handlers[`POST ${path}`] = handler;
      },
      get: (path: string, handler: (request: any, reply: any) => Promise<unknown>) => {
        handlers[`GET ${path}`] = handler;
      }
    } as FastifyInstance;

    const context = {
      db: {
        chatTypingState: {
          upsert: vi.fn(),
          findMany: vi.fn().mockResolvedValue([{
            userId: "user-1",
            expiresAt: new Date("2026-02-10T00:00:00.000Z"),
            user: {
              username: "dev",
              firstName: "Dev"
            }
          }])
        },
        chatMember: {
          findMany: vi.fn()
        }
      },
      redis: {
        set: vi.fn()
      },
      updates: {
        publishToUsers: vi.fn()
      }
    } as unknown as ApiContext;

    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "user-1" } as any
    });
    vi.mocked(chatMembershipEnsure).mockResolvedValue({ id: "m1" } as any);

    await typingRoutesRegister(app, context);

    const typingGet = handlers["GET /api/org/:orgid/channels/:channelId/typing"];
    if (!typingGet) {
      throw new Error("typing handler not registered");
    }
    const result = await typingGet({
      params: {
        orgid: "org-1",
        channelId: "chat-1"
      }
    }, {} as any);

    expect(result).toEqual({
      ok: true,
      data: {
        typing: [{
          userId: "user-1",
          username: "dev",
          firstName: "Dev",
          expiresAt: new Date("2026-02-10T00:00:00.000Z").getTime()
        }]
      }
    });
  });
});
