import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { authContextResolve } from "@/apps/api/lib/authContextResolve.js";
import { apiResponseOk } from "@/apps/api/lib/apiResponseOk.js";
import { chatMembershipEnsure } from "@/apps/api/lib/chatMembershipEnsure.js";

const typingBodySchema = z.object({
  threadRootMessageId: z.string().min(1).nullable().optional()
});

const TYPING_TTL_SECONDS = 5;

export async function typingRoutesRegister(app: FastifyInstance, context: ApiContext): Promise<void> {
  app.post("/api/org/:orgid/channels/:channelId/typing", async (request) => {
    const params = z.object({ orgid: z.string().min(1), channelId: z.string().min(1) }).parse(request.params);
    const body = typingBodySchema.parse(request.body);
    const auth = await authContextResolve(request, context, params.orgid);

    await chatMembershipEnsure(context, params.channelId, auth.user.id);

    const expiresAt = new Date(Date.now() + TYPING_TTL_SECONDS * 1000);

    await context.db.chatTypingState.upsert({
      where: {
        chatId_userId: {
          chatId: params.channelId,
          userId: auth.user.id
        }
      },
      create: {
        id: `${params.channelId}:${auth.user.id}`,
        chatId: params.channelId,
        userId: auth.user.id,
        expiresAt
      },
      update: {
        expiresAt
      }
    });

    const redisKey = `typing:${params.orgid}:${params.channelId}:${auth.user.id}`;
    await context.redis.set(redisKey, body.threadRootMessageId ?? "", "EX", TYPING_TTL_SECONDS);

    const recipients = await context.db.chatMember.findMany({
      where: {
        chatId: params.channelId,
        leftAt: null
      },
      select: {
        userId: true
      }
    });

    await context.updates.publishToUsers(recipients.map((item) => item.userId), "user.typing", {
      orgId: params.orgid,
      channelId: params.channelId,
      userId: auth.user.id,
      threadRootMessageId: body.threadRootMessageId ?? null,
      expiresAt: expiresAt.getTime()
    });

    return apiResponseOk({
      ok: true,
      expiresAt: expiresAt.getTime()
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
