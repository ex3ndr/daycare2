import Fastify from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testLiveContextCreate } from "@/utils/testLiveContextCreate.js";
import { rateLimitMiddleware } from "./rateLimitMiddleware.js";

type LiveContext = Awaited<ReturnType<typeof testLiveContextCreate>>;

describe("rateLimitMiddleware", () => {
  let live: LiveContext;

  beforeAll(async () => {
    live = await testLiveContextCreate();
  });

  beforeEach(async () => {
    await live.reset();
  });

  afterAll(async () => {
    await live.close();
  });

  it("passes through when under the limit", async () => {
    const app = Fastify();
    const middleware = rateLimitMiddleware(live.context, {
      scope: "messages.send",
      keyCreate: () => "user-1",
      limit: 5,
      windowSeconds: 60
    });

    app.get("/limited", async (request, reply) => {
      const allowed = await middleware(request, reply);
      if (!allowed) {
        return;
      }
      return { ok: true };
    });

    const response = await app.inject({ method: "GET", url: "/limited" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });

    await app.close();
  });

  it("returns 429 with Retry-After when over limit", async () => {
    const app = Fastify();
    const middleware = rateLimitMiddleware(live.context, {
      scope: "messages.send",
      keyCreate: () => "user-1",
      limit: 1,
      windowSeconds: 60
    });

    app.get("/limited", async (request, reply) => {
      const allowed = await middleware(request, reply);
      if (!allowed) {
        return;
      }
      return { ok: true };
    });

    const first = await app.inject({ method: "GET", url: "/limited" });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({ method: "GET", url: "/limited" });
    expect(second.statusCode).toBe(429);
    expect(second.headers["retry-after"]).toBeDefined();

    const payload = second.json() as {
      ok: boolean;
      error: {
        code: string;
      };
    };
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("RATE_LIMITED");

    await app.close();
  });
});
