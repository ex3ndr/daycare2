import type { FastifyReply, FastifyRequest } from "fastify";
import type { ApiContext } from "./apiContext.js";
import { describe, expect, it, vi } from "vitest";

const rateLimitCheckMock = vi.fn();

vi.mock("@/modules/rateLimit/rateLimitCheck.js", () => ({
  rateLimitCheck: rateLimitCheckMock
}));

function replyCreate(): FastifyReply {
  const reply = {
    header: vi.fn(),
    status: vi.fn(),
    send: vi.fn().mockResolvedValue(undefined)
  };

  reply.header.mockReturnValue(reply);
  reply.status.mockReturnValue(reply);

  return reply as unknown as FastifyReply;
}

describe("rateLimitMiddleware", () => {
  it("passes through when under the limit", async () => {
    rateLimitCheckMock.mockResolvedValue({
      allowed: true,
      remaining: 4,
      retryAfterSeconds: 0
    });
    const { rateLimitMiddleware } = await import("./rateLimitMiddleware.js");
    const middleware = rateLimitMiddleware({
      redis: {}
    } as ApiContext, {
      scope: "messages.send",
      keyCreate: () => "user-1",
      limit: 5,
      windowSeconds: 60
    });

    const reply = replyCreate();
    const allowed = await middleware({} as FastifyRequest, reply);

    expect(allowed).toBe(true);
    expect(rateLimitCheckMock).toHaveBeenCalledTimes(1);
    expect(reply.send).not.toHaveBeenCalled();
  });

  it("returns 429 with Retry-After when over limit", async () => {
    rateLimitCheckMock.mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 12
    });
    const { rateLimitMiddleware } = await import("./rateLimitMiddleware.js");
    const middleware = rateLimitMiddleware({
      redis: {}
    } as ApiContext, {
      scope: "messages.send",
      keyCreate: () => "user-1",
      limit: 5,
      windowSeconds: 60
    });

    const reply = replyCreate();
    const allowed = await middleware({} as FastifyRequest, reply);

    expect(allowed).toBe(false);
    expect(reply.header).toHaveBeenCalledWith("Retry-After", "12");
    expect(reply.status).toHaveBeenCalledWith(429);
    expect(reply.send).toHaveBeenCalledWith({
      ok: false,
      error: {
        code: "RATE_LIMITED",
        message: "Rate limit exceeded",
        details: undefined
      }
    });
  });
});
