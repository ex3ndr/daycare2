import Fastify from "fastify";
import type { ApiContext } from "../../lib/apiContext.js";
import { ApiError } from "../../lib/apiError.js";
import { apiResponseFail } from "../../lib/apiResponseFail.js";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../lib/accountSessionResolve.js", () => ({
  accountSessionResolve: vi.fn()
}));

import { accountSessionResolve } from "../../lib/accountSessionResolve.js";
import { authRoutesRegister } from "./authRoutesRegister.js";

function appCreate(context: ApiContext) {
  const app = Fastify();
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) {
      return reply.status(error.statusCode).send(apiResponseFail(error.code, error.message, error.details));
    }
    return reply.status(500).send(apiResponseFail("INTERNAL_ERROR", "Unexpected server error"));
  });
  void authRoutesRegister(app, context);
  return app;
}

describe("authRoutesRegister", () => {
  it("logs in with direct email in development", async () => {
    const context = {
      nodeEnv: "development",
      db: {
        account: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({
            id: "account-1",
            email: "dev@example.com",
            createdAt: new Date("2026-02-10T00:00:00.000Z"),
            updatedAt: new Date("2026-02-10T00:00:00.000Z")
          })
        },
        session: {
          create: vi.fn().mockResolvedValue({
            id: "session-1",
            expiresAt: new Date("2026-02-11T00:00:00.000Z")
          })
        },
        organization: {
          findMany: vi.fn()
        }
      },
      tokens: {
        issue: vi.fn().mockResolvedValue("token-1")
      }
    } as unknown as ApiContext;

    const app = appCreate(context);
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        email: "dev@example.com"
      }
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as any;
    expect(payload.ok).toBe(true);
    expect(payload.data.token).toBe("token-1");

    await app.close();
  });

  it("rejects direct email login in production", async () => {
    const context = {
      nodeEnv: "production",
      db: {
        account: {
          findUnique: vi.fn(),
          create: vi.fn()
        },
        session: {
          create: vi.fn()
        },
        organization: {
          findMany: vi.fn()
        }
      },
      tokens: {
        issue: vi.fn()
      }
    } as unknown as ApiContext;

    const app = appCreate(context);
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        email: "dev@example.com"
      }
    });

    expect(response.statusCode).toBe(403);
    const payload = response.json() as any;
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("FORBIDDEN");

    await app.close();
  });

  it("revokes session on logout", async () => {
    vi.mocked(accountSessionResolve).mockResolvedValue({
      session: {} as any,
      sessionId: "session-1",
      accountId: "account-1"
    });

    const context = {
      nodeEnv: "development",
      db: {
        account: {
          findUnique: vi.fn()
        },
        session: {
          create: vi.fn(),
          update: vi.fn().mockResolvedValue({})
        },
        organization: {
          findMany: vi.fn()
        }
      },
      tokens: {
        issue: vi.fn()
      }
    } as unknown as ApiContext;

    const app = appCreate(context);
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: {
        authorization: "Bearer token"
      }
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as any;
    expect(payload.ok).toBe(true);

    await app.close();
  });

  it("returns account and organizations on /me", async () => {
    vi.mocked(accountSessionResolve).mockResolvedValue({
      session: {} as any,
      sessionId: "session-1",
      accountId: "account-1"
    });

    const context = {
      nodeEnv: "development",
      db: {
        account: {
          findUnique: vi.fn().mockResolvedValue({
            id: "account-1",
            email: "dev@example.com",
            createdAt: new Date("2026-02-10T00:00:00.000Z"),
            updatedAt: new Date("2026-02-10T00:00:00.000Z")
          })
        },
        session: {
          create: vi.fn(),
          update: vi.fn()
        },
        organization: {
          findMany: vi.fn().mockResolvedValue([{
            id: "org-1",
            slug: "acme",
            name: "Acme",
            avatarUrl: null,
            createdAt: new Date("2026-02-10T00:00:00.000Z"),
            updatedAt: new Date("2026-02-10T00:00:00.000Z")
          }])
        }
      },
      tokens: {
        issue: vi.fn()
      }
    } as unknown as ApiContext;

    const app = appCreate(context);
    const response = await app.inject({
      method: "GET",
      url: "/api/me",
      headers: {
        authorization: "Bearer token"
      }
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as any;
    expect(payload.ok).toBe(true);
    expect(payload.data.organizations).toHaveLength(1);

    await app.close();
  });
});
