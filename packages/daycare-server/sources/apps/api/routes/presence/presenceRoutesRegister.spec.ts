import Fastify from "fastify";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { ApiError } from "@/apps/api/lib/apiError.js";
import { apiResponseFail } from "@/apps/api/lib/apiResponseFail.js";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/apps/api/lib/authContextResolve.js", () => ({
  authContextResolve: vi.fn()
}));

vi.mock("@/apps/api/lib/idempotencyGuard.js", () => ({
  idempotencyGuard: vi.fn((request: unknown, context: unknown, subject: unknown, handler: () => Promise<unknown>) => handler())
}));

import { authContextResolve } from "@/apps/api/lib/authContextResolve.js";
import { presenceRoutesRegister } from "./presenceRoutesRegister.js";

function appCreate(context: ApiContext) {
  const app = Fastify();
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) {
      return reply.status(error.statusCode).send(apiResponseFail(error.code, error.message, error.details));
    }
    return reply.status(500).send(apiResponseFail("INTERNAL_ERROR", "Unexpected server error"));
  });
  void presenceRoutesRegister(app, context);
  return app;
}

describe("presenceRoutesRegister", () => {
  it("sets user presence", async () => {
    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "user-1", organizationId: "org-1" } as any
    });

    const context = {
      redis: {
        set: vi.fn().mockResolvedValue("OK")
      },
      db: {
        user: {
          findMany: vi.fn().mockResolvedValue([{ id: "user-1" }])
        }
      },
      updates: {
        publishToUsers: vi.fn().mockResolvedValue(undefined)
      }
    } as unknown as ApiContext;

    const app = appCreate(context);
    const response = await app.inject({
      method: "POST",
      url: "/api/org/org-1/presence",
      headers: {
        authorization: "Bearer token"
      },
      payload: {
        status: "online"
      }
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as any;
    expect(payload.data.presence.status).toBe("online");
    expect(context.redis.set).toHaveBeenCalledWith("presence:org-1:user-1", "online", "EX", 90);
    expect(context.updates.publishToUsers).toHaveBeenCalledTimes(1);

    await app.close();
  });

  it("heartbeats presence and updates lastSeenAt", async () => {
    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "user-1", organizationId: "org-1" } as any
    });

    const context = {
      redis: {
        get: vi.fn().mockResolvedValue("away"),
        set: vi.fn().mockResolvedValue("OK")
      },
      db: {
        user: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 })
        }
      }
    } as unknown as ApiContext;

    const app = appCreate(context);
    const response = await app.inject({
      method: "POST",
      url: "/api/org/org-1/presence/heartbeat",
      headers: {
        authorization: "Bearer token"
      }
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as any;
    expect(payload.data.presence.status).toBe("away");
    expect(context.redis.set).toHaveBeenCalledWith("presence:org-1:user-1", "away", "EX", 90);
    expect(context.db.user.updateMany).toHaveBeenCalledTimes(1);

    await app.close();
  });

  it("returns presence for multiple users", async () => {
    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "user-1", organizationId: "org-1" } as any
    });

    const context = {
      redis: {
        mget: vi.fn().mockResolvedValue(["online", null])
      }
    } as unknown as ApiContext;

    const app = appCreate(context);
    const response = await app.inject({
      method: "GET",
      url: "/api/org/org-1/presence?userIds=user-1,user-2",
      headers: {
        authorization: "Bearer token"
      }
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as any;
    expect(payload.data.presence).toEqual([
      { userId: "user-1", status: "online" },
      { userId: "user-2", status: "offline" }
    ]);

    await app.close();
  });

  it("rejects presence query with too many userIds", async () => {
    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "user-1", organizationId: "org-1" } as any
    });

    const context = {
      redis: {
        mget: vi.fn()
      }
    } as unknown as ApiContext;

    const app = appCreate(context);
    const userIds = Array.from({ length: 101 }, (_, index) => `u${index + 1}`).join(",");
    const response = await app.inject({
      method: "GET",
      url: `/api/org/org-1/presence?userIds=${userIds}`,
      headers: {
        authorization: "Bearer token"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(context.redis.mget).not.toHaveBeenCalled();

    await app.close();
  });
});
