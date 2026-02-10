import Fastify from "fastify";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { ApiError } from "@/apps/api/lib/apiError.js";
import { apiResponseFail } from "@/apps/api/lib/apiResponseFail.js";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/apps/api/lib/accountSessionResolve.js", () => ({
  accountSessionResolve: vi.fn()
}));

vi.mock("@/apps/api/lib/authContextResolve.js", () => ({
  authContextResolve: vi.fn()
}));

vi.mock("@/apps/api/lib/organizationRecipientIdsResolve.js", () => ({
  organizationRecipientIdsResolve: vi.fn()
}));

vi.mock("@/apps/api/lib/idempotencyGuard.js", () => ({
  idempotencyGuard: vi.fn((request: unknown, context: unknown, subject: unknown, handler: () => Promise<unknown>) => handler())
}));

import { accountSessionResolve } from "@/apps/api/lib/accountSessionResolve.js";
import { authContextResolve } from "@/apps/api/lib/authContextResolve.js";
import { organizationRecipientIdsResolve } from "@/apps/api/lib/organizationRecipientIdsResolve.js";
import { orgRoutesRegister } from "./orgRoutesRegister.js";

function appCreate(context: ApiContext) {
  const app = Fastify();
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) {
      return reply.status(error.statusCode).send(apiResponseFail(error.code, error.message, error.details));
    }
    return reply.status(500).send(apiResponseFail("INTERNAL_ERROR", "Unexpected server error"));
  });
  void orgRoutesRegister(app, context);
  return app;
}

describe("orgRoutesRegister", () => {
  it("lists organizations for account", async () => {
    vi.mocked(accountSessionResolve).mockResolvedValue({
      session: {} as any,
      sessionId: "session-1",
      accountId: "account-1"
    });

    const context = {
      allowOpenOrgJoin: true,
      db: {
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
      }
    } as unknown as ApiContext;

    const app = appCreate(context);
    const response = await app.inject({
      method: "GET",
      url: "/api/org/available",
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

  it("creates an organization", async () => {
    vi.mocked(accountSessionResolve).mockResolvedValue({
      session: {} as any,
      sessionId: "session-1",
      accountId: "account-1"
    });
    vi.mocked(organizationRecipientIdsResolve).mockResolvedValue(["user-1"]);

    const context = {
      allowOpenOrgJoin: true,
      db: {
        organization: {
          create: vi.fn().mockResolvedValue({
            id: "org-1",
            slug: "acme",
            name: "Acme",
            avatarUrl: null,
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
      url: "/api/org/create",
      headers: {
        authorization: "Bearer token"
      },
      payload: {
        slug: "acme",
        name: "Acme",
        firstName: "Dev",
        username: "dev"
      }
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as any;
    expect(payload.ok).toBe(true);
    expect(context.updates.publishToUsers).toHaveBeenCalled();

    await app.close();
  });

  it("joins an organization", async () => {
    vi.mocked(accountSessionResolve).mockResolvedValue({
      session: {} as any,
      sessionId: "session-1",
      accountId: "account-1"
    });
    vi.mocked(organizationRecipientIdsResolve).mockResolvedValue(["user-1"]);

    const context = {
      allowOpenOrgJoin: true,
      db: {
        organization: {
          findUnique: vi.fn().mockResolvedValue({
            id: "org-1"
          })
        },
        user: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({
            id: "user-1",
            organizationId: "org-1",
            username: "dev",
            firstName: "Dev",
            lastName: null,
            avatarUrl: null,
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
      url: "/api/org/org-1/join",
      headers: {
        authorization: "Bearer token"
      },
      payload: {
        firstName: "Dev",
        username: "dev"
      }
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as any;
    expect(payload.ok).toBe(true);
    expect(context.updates.publishToUsers).toHaveBeenCalled();

    await app.close();
  });

  it("rejects join when open org join is disabled", async () => {
    vi.mocked(accountSessionResolve).mockResolvedValue({
      session: {} as any,
      sessionId: "session-1",
      accountId: "account-1"
    });

    const context = {
      allowOpenOrgJoin: false,
      db: {
        organization: {
          findUnique: vi.fn()
        }
      }
    } as unknown as ApiContext;

    const app = appCreate(context);
    const response = await app.inject({
      method: "POST",
      url: "/api/org/org-1/join",
      headers: {
        authorization: "Bearer token"
      },
      payload: {
        firstName: "Dev",
        username: "dev"
      }
    });

    expect(response.statusCode).toBe(403);

    await app.close();
  });

  it("returns 404 when joining unknown organization", async () => {
    vi.mocked(accountSessionResolve).mockResolvedValue({
      session: {} as any,
      sessionId: "session-1",
      accountId: "account-1"
    });

    const context = {
      allowOpenOrgJoin: true,
      db: {
        organization: {
          findUnique: vi.fn().mockResolvedValue(null)
        },
        user: {
          findFirst: vi.fn()
        }
      }
    } as unknown as ApiContext;

    const app = appCreate(context);
    const response = await app.inject({
      method: "POST",
      url: "/api/org/org-1/join",
      headers: {
        authorization: "Bearer token"
      },
      payload: {
        firstName: "Dev",
        username: "dev"
      }
    });

    expect(response.statusCode).toBe(404);

    await app.close();
  });

  it("returns organization profile", async () => {
    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "user-1", organizationId: "org-1" } as any
    });

    const context = {
      allowOpenOrgJoin: true,
      db: {
        organization: {
          findUnique: vi.fn().mockResolvedValue({
            id: "org-1",
            slug: "acme",
            name: "Acme",
            avatarUrl: null,
            createdAt: new Date("2026-02-10T00:00:00.000Z"),
            updatedAt: new Date("2026-02-10T00:00:00.000Z")
          })
        }
      }
    } as unknown as ApiContext;

    const app = appCreate(context);
    const response = await app.inject({
      method: "GET",
      url: "/api/org/org-1",
      headers: {
        authorization: "Bearer token"
      }
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as any;
    expect(payload.ok).toBe(true);

    await app.close();
  });

  it("lists members and updates profile", async () => {
    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: {
        id: "user-1",
        organizationId: "org-1",
        kind: "HUMAN",
        username: "dev",
        firstName: "Dev",
        lastName: null,
        bio: null,
        timezone: null,
        avatarUrl: null,
        systemPrompt: null,
        createdAt: new Date("2026-02-10T00:00:00.000Z"),
        updatedAt: new Date("2026-02-10T00:00:00.000Z")
      } as any
    });
    vi.mocked(organizationRecipientIdsResolve).mockResolvedValue(["user-1"]);

    const context = {
      allowOpenOrgJoin: true,
      db: {
        user: {
          findMany: vi.fn().mockResolvedValue([{
            id: "user-1",
            kind: "HUMAN",
            username: "dev",
            firstName: "Dev",
            lastName: null,
            avatarUrl: null,
            createdAt: new Date("2026-02-10T00:00:00.000Z"),
            updatedAt: new Date("2026-02-10T00:00:00.000Z")
          }]),
          update: vi.fn().mockResolvedValue({
            id: "user-1",
            organizationId: "org-1",
            kind: "HUMAN",
            username: "dev",
            firstName: "Dev",
            lastName: null,
            bio: null,
            timezone: null,
            avatarUrl: null,
            systemPrompt: null,
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
    const membersResponse = await app.inject({
      method: "GET",
      url: "/api/org/org-1/members",
      headers: {
        authorization: "Bearer token"
      }
    });
    expect(membersResponse.statusCode).toBe(200);

    const profileResponse = await app.inject({
      method: "PATCH",
      url: "/api/org/org-1/profile",
      headers: {
        authorization: "Bearer token"
      },
      payload: {
        firstName: "Dev"
      }
    });
    expect(profileResponse.statusCode).toBe(200);
    expect(context.updates.publishToUsers).toHaveBeenCalled();

    await app.close();
  });
});
