import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { authContextResolve } from "@/apps/api/lib/authContextResolve.js";
import { apiResponseOk } from "@/apps/api/lib/apiResponseOk.js";
import { chatMembershipEnsure } from "@/apps/api/lib/chatMembershipEnsure.js";

export async function readRoutesRegister(app: FastifyInstance, context: ApiContext): Promise<void> {
  app.post("/api/org/:orgid/channels/:channelId/read", async (request) => {
    const params = z.object({ orgid: z.string().min(1), channelId: z.string().min(1) }).parse(request.params);
    const auth = await authContextResolve(request, context, params.orgid);

    const membership = await chatMembershipEnsure(context, params.channelId, auth.user.id);
    const readAt = new Date();

    await context.db.chatMember.update({
      where: {
        id: membership.id
      },
      data: {
        lastReadAt: readAt
      }
    });

    return apiResponseOk({
      chatId: params.channelId,
      lastReadAt: readAt.getTime()
    });
  });

  app.get("/api/org/:orgid/channels/:channelId/read-state", async (request) => {
    const params = z.object({ orgid: z.string().min(1), channelId: z.string().min(1) }).parse(request.params);
    const auth = await authContextResolve(request, context, params.orgid);

    const membership = await chatMembershipEnsure(context, params.channelId, auth.user.id);

    const unreadCount = await context.db.message.count({
      where: {
        chatId: params.channelId,
        deletedAt: null,
        createdAt: membership.lastReadAt
          ? {
              gt: membership.lastReadAt
            }
          : undefined
      }
    });

    return apiResponseOk({
      chatId: params.channelId,
      lastReadAt: membership.lastReadAt?.getTime() ?? null,
      unreadCount
    });
  });
}
