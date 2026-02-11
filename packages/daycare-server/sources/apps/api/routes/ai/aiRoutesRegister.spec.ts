import Fastify from "fastify";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { ApiError } from "@/apps/api/lib/apiError.js";
import { apiResponseFail } from "@/apps/api/lib/apiResponseFail.js";
import { describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

vi.mock("@/apps/api/lib/authContextResolve.js", () => ({
  authContextResolve: vi.fn()
}));

vi.mock("@/apps/api/lib/idempotencyGuard.js", () => ({
  idempotencyGuard: vi.fn((request: unknown, context: unknown, subject: unknown, handler: () => Promise<unknown>) => handler())
}));

import { authContextResolve } from "@/apps/api/lib/authContextResolve.js";
import { aiRoutesRegister } from "./aiRoutesRegister.js";

function appCreate(context: ApiContext) {
  const app = Fastify();
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) {
      return reply.status(error.statusCode).send(apiResponseFail(error.code, error.message, error.details));
    }
    if (error instanceof ZodError) {
      return reply.status(400).send(apiResponseFail("BAD_REQUEST", "Validation failed", { issues: error.issues }));
    }
    return reply.status(500).send(apiResponseFail("INTERNAL_ERROR", "Unexpected server error"));
  });
  void aiRoutesRegister(app, context);
  return app;
}

describe("aiRoutesRegister", () => {
  it("creates a bot", async () => {
    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "owner-1", organizationId: "org-1" } as any
    });

    const context = {
      db: {
        chatMember: {
          findFirst: vi.fn().mockResolvedValue({ id: "owner-member" })
        },
        user: {
          create: vi.fn().mockResolvedValue({
            id: "bot-1",
            organizationId: "org-1",
            kind: "AI",
            username: "helper",
            firstName: "Helper",
            avatarUrl: null,
            systemPrompt: "help",
            webhookUrl: "https://example.com/webhook",
            createdAt: new Date("2026-02-11T00:00:00.000Z"),
            updatedAt: new Date("2026-02-11T00:00:00.000Z")
          })
        }
      }
    } as unknown as ApiContext;

    const app = appCreate(context);
    const response = await app.inject({
      method: "POST",
      url: "/api/org/org-1/bots",
      headers: { authorization: "Bearer token" },
      payload: {
        username: "helper",
        firstName: "Helper",
        systemPrompt: "help",
        webhookUrl: "https://example.com/webhook"
      }
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as any;
    expect(payload.data.bot.id).toBe("bot-1");
    await app.close();
  });

  it("lists bots", async () => {
    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "owner-1", organizationId: "org-1" } as any
    });

    const context = {
      db: {
        chatMember: {
          findFirst: vi.fn().mockResolvedValue({ id: "owner-member" })
        },
        user: {
          findMany: vi.fn().mockResolvedValue([{
            id: "bot-1",
            organizationId: "org-1",
            kind: "AI",
            username: "helper",
            firstName: "Helper",
            avatarUrl: null,
            systemPrompt: "help",
            webhookUrl: "https://example.com/webhook",
            createdAt: new Date("2026-02-11T00:00:00.000Z"),
            updatedAt: new Date("2026-02-11T00:00:00.000Z")
          }])
        }
      }
    } as unknown as ApiContext;

    const app = appCreate(context);
    const response = await app.inject({
      method: "GET",
      url: "/api/org/org-1/bots",
      headers: { authorization: "Bearer token" }
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as any;
    expect(payload.data.bots).toHaveLength(1);
    await app.close();
  });

  it("rejects non-https avatar URLs", async () => {
    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "owner-1", organizationId: "org-1" } as any
    });

    const context = {
      db: {
        chatMember: {
          findFirst: vi.fn().mockResolvedValue({ id: "owner-member" })
        },
        user: {
          create: vi.fn()
        }
      }
    } as unknown as ApiContext;

    const app = appCreate(context);
    const response = await app.inject({
      method: "POST",
      url: "/api/org/org-1/bots",
      headers: { authorization: "Bearer token" },
      payload: {
        username: "helper",
        firstName: "Helper",
        systemPrompt: "help",
        webhookUrl: "https://example.com/webhook",
        avatarUrl: "http://example.com/avatar.png"
      }
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it("updates a bot", async () => {
    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "owner-1", organizationId: "org-1" } as any
    });

    const context = {
      db: {
        chatMember: {
          findFirst: vi.fn().mockResolvedValue({ id: "owner-member" })
        },
        user: {
          findFirst: vi.fn().mockResolvedValue({ id: "bot-1", kind: "AI" }),
          update: vi.fn().mockResolvedValue({
            id: "bot-1",
            organizationId: "org-1",
            kind: "AI",
            username: "helper",
            firstName: "Helper2",
            avatarUrl: null,
            systemPrompt: "help",
            webhookUrl: "https://example.com/new",
            createdAt: new Date("2026-02-11T00:00:00.000Z"),
            updatedAt: new Date("2026-02-11T00:00:00.000Z")
          })
        }
      }
    } as unknown as ApiContext;

    const app = appCreate(context);
    const response = await app.inject({
      method: "PATCH",
      url: "/api/org/org-1/bots/bot-1",
      headers: { authorization: "Bearer token" },
      payload: {
        firstName: "Helper2",
        webhookUrl: "https://example.com/new"
      }
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as any;
    expect(payload.data.bot.firstName).toBe("Helper2");
    await app.close();
  });

  it("rejects empty bot updates", async () => {
    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "owner-1", organizationId: "org-1" } as any
    });

    const context = {
      db: {
        chatMember: {
          findFirst: vi.fn().mockResolvedValue({ id: "owner-member" })
        },
        user: {
          findFirst: vi.fn(),
          update: vi.fn()
        }
      }
    } as unknown as ApiContext;

    const app = appCreate(context);
    const response = await app.inject({
      method: "PATCH",
      url: "/api/org/org-1/bots/bot-1",
      headers: { authorization: "Bearer token" },
      payload: {}
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });
});
