import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { channelCreate } from "@/apps/channels/channelCreate.js";
import { channelJoin } from "@/apps/channels/channelJoin.js";
import { channelLeave } from "@/apps/channels/channelLeave.js";
import { channelUpdate } from "@/apps/channels/channelUpdate.js";
import { authContextResolve } from "@/apps/api/lib/authContextResolve.js";
import { apiResponseOk } from "@/apps/api/lib/apiResponseOk.js";
import { chatMembershipEnsure } from "@/apps/api/lib/chatMembershipEnsure.js";
import { idempotencyGuard } from "@/apps/api/lib/idempotencyGuard.js";

const channelCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  topic: z.string().trim().max(1024).nullable().optional(),
  visibility: z.enum(["public", "private"]).default("public")
});

const channelPatchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  topic: z.string().trim().max(1024).nullable().optional()
});

export async function channelRoutesRegister(app: FastifyInstance, context: ApiContext): Promise<void> {
  app.get("/api/org/:orgid/channels", async (request) => {
    const params = z.object({ orgid: z.string().min(1) }).parse(request.params);
    const auth = await authContextResolve(request, context, params.orgid);

    const channels = await context.db.chat.findMany({
      where: {
        organizationId: auth.user.organizationId,
        kind: "CHANNEL",
        archivedAt: null,
        OR: [
          { visibility: "PUBLIC" },
          { visibility: null },
          {
            members: {
              some: {
                userId: auth.user.id,
                leftAt: null
              }
            }
          }
        ]
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    return apiResponseOk({
      channels: channels.map((channel) => ({
        id: channel.id,
        organizationId: channel.organizationId,
        name: channel.name,
        topic: channel.topic,
        visibility: channel.visibility?.toLowerCase() ?? "public",
        createdAt: channel.createdAt.getTime(),
        updatedAt: channel.updatedAt.getTime()
      }))
    });
  });

  app.post("/api/org/:orgid/channels", async (request) => {
    const params = z.object({ orgid: z.string().min(1) }).parse(request.params);
    const auth = await authContextResolve(request, context, params.orgid);
    const body = channelCreateSchema.parse(request.body);

    return await idempotencyGuard(request, context, { type: "user", id: auth.user.id }, async () => {
      const chat = await channelCreate(context, {
        organizationId: auth.user.organizationId,
        userId: auth.user.id,
        name: body.name,
        topic: body.topic,
        visibility: body.visibility
      });

      return apiResponseOk({
        channel: {
          id: chat.id,
          organizationId: chat.organizationId,
          name: chat.name,
          topic: chat.topic,
          visibility: chat.visibility?.toLowerCase() ?? "public",
          createdAt: chat.createdAt.getTime(),
          updatedAt: chat.updatedAt.getTime()
        }
      });
    });
  });

  app.patch("/api/org/:orgid/channels/:channelId", async (request) => {
    const params = z.object({ orgid: z.string().min(1), channelId: z.string().min(1) }).parse(request.params);
    const auth = await authContextResolve(request, context, params.orgid);
    const body = channelPatchSchema.parse(request.body);

    return await idempotencyGuard(request, context, { type: "user", id: auth.user.id }, async () => {
      await chatMembershipEnsure(context, params.channelId, auth.user.id);

      const channel = await channelUpdate(context, {
        organizationId: params.orgid,
        channelId: params.channelId,
        name: body.name,
        topic: body.topic
      });

      return apiResponseOk({
        channel: {
          id: channel.id,
          organizationId: channel.organizationId,
          name: channel.name,
          topic: channel.topic,
          visibility: channel.visibility?.toLowerCase() ?? "public",
          createdAt: channel.createdAt.getTime(),
          updatedAt: channel.updatedAt.getTime()
        }
      });
    });
  });

  app.post("/api/org/:orgid/channels/:channelId/join", async (request) => {
    const params = z.object({ orgid: z.string().min(1), channelId: z.string().min(1) }).parse(request.params);
    const auth = await authContextResolve(request, context, params.orgid);

    return await idempotencyGuard(request, context, { type: "user", id: auth.user.id }, async () => {
      const { membership } = await channelJoin(context, {
        organizationId: params.orgid,
        channelId: params.channelId,
        userId: auth.user.id
      });

      return apiResponseOk({
        joined: true,
        membership: {
          chatId: membership.chatId,
          userId: membership.userId,
          role: membership.role.toLowerCase(),
          joinedAt: membership.joinedAt.getTime(),
          leftAt: membership.leftAt?.getTime() ?? null
        }
      });
    });
  });

  app.post("/api/org/:orgid/channels/:channelId/leave", async (request) => {
    const params = z.object({ orgid: z.string().min(1), channelId: z.string().min(1) }).parse(request.params);
    const auth = await authContextResolve(request, context, params.orgid);

    return await idempotencyGuard(request, context, { type: "user", id: auth.user.id }, async () => {
      const membership = await channelLeave(context, {
        organizationId: auth.user.organizationId,
        channelId: params.channelId,
        userId: auth.user.id
      });

      return apiResponseOk({
        left: true,
        membership: {
          chatId: membership.chatId,
          userId: membership.userId,
          role: membership.role.toLowerCase(),
          joinedAt: membership.joinedAt.getTime(),
          leftAt: membership.leftAt?.getTime() ?? null
        }
      });
    });
  });

  app.get("/api/org/:orgid/channels/:channelId/members", async (request) => {
    const params = z.object({ orgid: z.string().min(1), channelId: z.string().min(1) }).parse(request.params);
    const auth = await authContextResolve(request, context, params.orgid);

    await chatMembershipEnsure(context, params.channelId, auth.user.id);

    const members = await context.db.chatMember.findMany({
      where: {
        chatId: params.channelId,
        leftAt: null
      },
      include: {
        user: true
      },
      orderBy: {
        joinedAt: "asc"
      }
    });

    return apiResponseOk({
      members: members.map((member) => ({
        chatId: member.chatId,
        userId: member.userId,
        role: member.role.toLowerCase(),
        joinedAt: member.joinedAt.getTime(),
        user: {
          id: member.user.id,
          kind: member.user.kind.toLowerCase(),
          username: member.user.username,
          firstName: member.user.firstName,
          lastName: member.user.lastName,
          avatarUrl: member.user.avatarUrl
        }
      }))
    });
  });
}
