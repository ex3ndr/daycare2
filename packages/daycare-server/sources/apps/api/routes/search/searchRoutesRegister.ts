import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { apiResponseOk } from "@/apps/api/lib/apiResponseOk.js";
import { authContextResolve } from "@/apps/api/lib/authContextResolve.js";
import { channelSearch } from "@/apps/channels/channelSearch.js";
import { messageSearch } from "@/apps/messages/messageSearch.js";
import { rateLimitMiddleware } from "@/apps/api/lib/rateLimitMiddleware.js";

const messageSearchQuerySchema = z.object({
  q: z.string().trim().min(1),
  channelId: z.string().min(1).optional(),
  before: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional()
});

const channelSearchQuerySchema = z.object({
  q: z.string().trim().min(1),
  limit: z.coerce.number().int().min(1).max(100).optional()
});

export async function searchRoutesRegister(app: FastifyInstance, context: ApiContext): Promise<void> {
  const searchRateLimit = rateLimitMiddleware(context, {
    scope: "search",
    limit: 20,
    windowSeconds: 60,
    keyCreate: async (request) => {
      const params = z.object({ orgid: z.string().min(1) }).parse(request.params);
      const auth = await authContextResolve(request, context, params.orgid);
      return auth.user.id;
    },
    message: "Too many search requests. Please retry later."
  });

  app.get("/api/org/:orgid/search/messages", async (request, reply) => {
    const allowed = await searchRateLimit(request, reply);
    if (!allowed) {
      return;
    }

    const params = z.object({ orgid: z.string().min(1) }).parse(request.params);
    const query = messageSearchQuerySchema.parse(request.query);
    const auth = await authContextResolve(request, context, params.orgid);

    const messages = await messageSearch(context, {
      organizationId: params.orgid,
      userId: auth.user.id,
      query: query.q,
      channelId: query.channelId,
      before: query.before,
      limit: query.limit
    });

    return apiResponseOk({
      messages
    });
  });

  app.get("/api/org/:orgid/search/channels", async (request, reply) => {
    const allowed = await searchRateLimit(request, reply);
    if (!allowed) {
      return;
    }

    const params = z.object({ orgid: z.string().min(1) }).parse(request.params);
    const query = channelSearchQuerySchema.parse(request.query);
    const auth = await authContextResolve(request, context, params.orgid);

    const channels = await channelSearch(context, {
      organizationId: params.orgid,
      userId: auth.user.id,
      query: query.q,
      limit: query.limit
    });

    return apiResponseOk({
      channels
    });
  });
}
