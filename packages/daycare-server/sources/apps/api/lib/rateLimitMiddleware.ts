import type { FastifyReply, FastifyRequest } from "fastify";
import type { ApiContext } from "./apiContext.js";
import { apiResponseFail } from "./apiResponseFail.js";
import { rateLimitCheck } from "@/modules/rateLimit/rateLimitCheck.js";

export type RateLimitMiddlewareInput = {
  scope: string;
  limit: number;
  windowSeconds: number;
  keyCreate: (request: FastifyRequest) => Promise<string> | string;
  message?: string;
};

export function rateLimitMiddleware(
  context: ApiContext,
  input: RateLimitMiddlewareInput
): (request: FastifyRequest, reply: FastifyReply) => Promise<boolean> {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<boolean> => {
    const key = await input.keyCreate(request);
    const result = await rateLimitCheck(context.redis, {
      scope: input.scope,
      key,
      limit: input.limit,
      windowSeconds: input.windowSeconds
    });

    if (result.allowed) {
      return true;
    }

    reply.header("Retry-After", String(result.retryAfterSeconds));
    await reply.status(429).send(apiResponseFail(
      "RATE_LIMITED",
      input.message ?? "Rate limit exceeded"
    ));

    return false;
  };
}
