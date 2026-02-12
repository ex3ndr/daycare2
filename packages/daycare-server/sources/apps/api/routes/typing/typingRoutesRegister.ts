import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { channelTypingSet } from "@/apps/channels/channelTypingSet.js";
import { authContextResolve } from "@/apps/api/lib/authContextResolve.js";
import { apiResponseOk } from "@/apps/api/lib/apiResponseOk.js";
import { chatMembershipEnsure } from "@/apps/api/lib/chatMembershipEnsure.js";
import { rateLimitMiddleware } from "@/apps/api/lib/rateLimitMiddleware.js";

const typingBodySchema = z.object({
  threadRootMessageId: z.string().min(1).nullable().optional()
});

export async function typingRoutesRegister(app: FastifyInstance, context: ApiContext): Promise<void> {
  const typingRateLimit = rateLimitMiddleware(context, {
    scope: "typing",
    limit: 10,
    windowSeconds: 60,
    keyCreate: async (request) => {
      const params = z.object({ orgid: z.string().min(1), channelId: z.string().min(1) }).parse(request.params);
      const auth = await authContextResolve(request, context, params.orgid);
      return `${auth.user.id}:${params.channelId}`;
    },
    message: "Too many typing updates. Please retry later."
  });

  app.post("/api/org/:orgid/channels/:channelId/typing", async (request, reply) => {
    const allowed = await typingRateLimit(request, reply);
    if (!allowed) {
      return;
    }

    const params = z.object({ orgid: z.string().min(1), channelId: z.string().min(1) }).parse(request.params);
    const body = typingBodySchema.parse(request.body);
    const auth = await authContextResolve(request, context, params.orgid);

    await chatMembershipEnsure(context, params.channelId, auth.user.id);

    const result = await channelTypingSet(context, {
      organizationId: params.orgid,
      channelId: params.channelId,
      userId: auth.user.id,
      username: auth.user.username,
      firstName: auth.user.firstName,
      threadRootMessageId: body.threadRootMessageId ?? null
    });

    return apiResponseOk({
      ok: true,
      expiresAt: result.expiresAt
    });
  });

  app.get("/api/org/:orgid/channels/:channelId/typing", async (request) => {
    const params = z.object({ orgid: z.string().min(1), channelId: z.string().min(1) }).parse(request.params);
    const auth = await authContextResolve(request, context, params.orgid);

    await chatMembershipEnsure(context, params.channelId, auth.user.id);

    const active = await context.db.chatTypingState.findMany({
      where: {
        chatId: params.channelId,
        expiresAt: {
          gt: new Date()
        }
      },
      include: {
        user: true
      },
      orderBy: {
        updatedAt: "desc"
      }
    });

    return apiResponseOk({
      typing: active.map((item) => ({
        userId: item.userId,
        username: item.user.username,
        firstName: item.user.firstName,
        expiresAt: item.expiresAt.getTime()
      }))
    });
  });
}
