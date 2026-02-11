import Fastify from "fastify";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { ApiError } from "@/apps/api/lib/apiError.js";
import { apiResponseFail } from "@/apps/api/lib/apiResponseFail.js";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/apps/api/lib/authContextResolve.js", () => ({
  authContextResolve: vi.fn()
}));

import { authContextResolve } from "@/apps/api/lib/authContextResolve.js";
import { searchRoutesRegister } from "./searchRoutesRegister.js";

function appCreate(context: ApiContext) {
  const app = Fastify();
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) {
      return reply.status(error.statusCode).send(apiResponseFail(error.code, error.message, error.details));
    }
    return reply.status(500).send(apiResponseFail("INTERNAL_ERROR", "Unexpected server error"));
  });
  void searchRoutesRegister(app, context);
  return app;
}

describe("searchRoutesRegister", () => {
  it("searches messages", async () => {
    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "user-1", organizationId: "org-1" } as any
    });

    const context = {
      db: {
        $queryRaw: vi.fn().mockResolvedValue([{
          id: "m-1",
          chatId: "chat-1",
          senderUserId: "user-2",
          text: "hello",
          highlight: "hello",
          createdAt: new Date("2026-02-11T00:00:00.000Z")
        }])
      }
    } as unknown as ApiContext;

    const app = appCreate(context);
    const response = await app.inject({
      method: "GET",
      url: "/api/org/org-1/search/messages?q=hello",
      headers: {
        authorization: "Bearer token"
      }
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as any;
    expect(payload.data.messages).toHaveLength(1);
    expect(payload.data.messages[0]?.id).toBe("m-1");
    await app.close();
  });

  it("searches channels", async () => {
    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "user-1", organizationId: "org-1" } as any
    });

    const context = {
      db: {
        $queryRaw: vi.fn().mockResolvedValue([{
          id: "chat-1",
          organizationId: "org-1",
          name: "general",
          topic: null,
          visibility: "PUBLIC",
          createdAt: new Date("2026-02-11T00:00:00.000Z"),
          updatedAt: new Date("2026-02-11T00:00:00.000Z")
        }])
      }
    } as unknown as ApiContext;

    const app = appCreate(context);
    const response = await app.inject({
      method: "GET",
      url: "/api/org/org-1/search/channels?q=general",
      headers: {
        authorization: "Bearer token"
      }
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as any;
    expect(payload.data.channels).toHaveLength(1);
    expect(payload.data.channels[0]?.id).toBe("chat-1");
    await app.close();
  });
});
