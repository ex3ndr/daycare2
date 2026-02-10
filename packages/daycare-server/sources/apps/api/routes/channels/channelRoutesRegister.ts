import { createId } from "@paralleldrive/cuid2";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ApiContext } from "../../lib/apiContext.js";
import { authContextResolve } from "../../lib/authContextResolve.js";
import { ApiError } from "../../lib/apiError.js";
import { apiResponseOk } from "../../lib/apiResponseOk.js";
import { chatMembershipEnsure } from "../../lib/chatMembershipEnsure.js";
import { chatRecipientIdsResolve } from "../../lib/chatRecipientIdsResolve.js";
import { organizationRecipientIdsResolve } from "../../lib/organizationRecipientIdsResolve.js";
import { idempotencyGuard } from "../../lib/idempotencyGuard.js";

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
      const chat = await context.db.chat.create({
        data: {
          id: createId(),
          organizationId: auth.user.organizationId,
          createdByUserId: auth.user.id,
          kind: "CHANNEL",
          name: body.name,
          topic: body.topic,
          visibility: body.visibility === "public" ? "PUBLIC" : "PRIVATE",
          members: {
            create: {
              id: createId(),
              userId: auth.user.id,
              role: "OWNER",
              notificationLevel: "ALL"
            }
          }
        }
      });

      const recipients = await organizationRecipientIdsResolve(context, chat.organizationId);
      await context.updates.publishToUsers(recipients, "channel.created", {
        orgId: chat.organizationId,
        channelId: chat.id
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
      const channelInOrg = await context.db.chat.findFirst({
        where: {
          id: params.channelId,
          organizationId: params.orgid,
          kind: "CHANNEL"
        },
        select: {
          id: true
        }
      });

      if (!channelInOrg) {
        throw new ApiError(404, "NOT_FOUND", "Channel not found");
      }

      const channel = await context.db.chat.update({
        where: {
          id: channelInOrg.id
        },
        data: {
          name: body.name,
          topic: body.topic
        }
      });

      const recipients = await chatRecipientIdsResolve(context, channel.id);
      await context.updates.publishToUsers(recipients, "channel.updated", {
        orgId: channel.organizationId,
        channelId: channel.id
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
      const channel = await context.db.chat.findFirst({
        where: {
          id: params.channelId,
          organizationId: params.orgid,
          kind: "CHANNEL"
        }
      });

      if (!channel) {
        throw new ApiError(404, "NOT_FOUND", "Channel not found");
      }

      if (channel.visibility === "PRIVATE") {
        throw new ApiError(403, "FORBIDDEN", "Private channels require an invitation");
      }

      const activeMembership = await context.db.chatMember.findFirst({
        where: {
          chatId: params.channelId,
          userId: auth.user.id,
          leftAt: null
        }
      });

      let membership;
      if (activeMembership) {
        membership = activeMembership;
      } else {
        const historicalMembership = await context.db.chatMember.findFirst({
          where: {
            chatId: params.channelId,
            userId: auth.user.id
          },
          orderBy: {
            joinedAt: "desc"
          }
        });

        if (historicalMembership) {
          membership = await context.db.chatMember.update({
            where: {
              id: historicalMembership.id
            },
            data: {
              leftAt: null,
              joinedAt: new Date()
            }
          });
        } else {
          membership = await context.db.chatMember.create({
            data: {
              id: createId(),
              chatId: params.channelId,
              userId: auth.user.id,
              role: "MEMBER",
              notificationLevel: "ALL"
            }
          });
        }
      }

      const recipients = await chatRecipientIdsResolve(context, params.channelId);
      await context.updates.publishToUsers(recipients, "channel.member.joined", {
        orgId: channel.organizationId,
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
      const existing = await context.db.chatMember.findFirst({
        where: {
          chatId: params.channelId,
          userId: auth.user.id,
          leftAt: null
        }
      });

      if (!existing) {
        throw new ApiError(404, "NOT_FOUND", "Membership not found");
      }

      const membership = await context.db.chatMember.update({
        where: {
          id: existing.id
        },
        data: {
          leftAt: new Date()
        }
      });

      const recipients = await chatRecipientIdsResolve(context, params.channelId);
      await context.updates.publishToUsers(recipients, "channel.member.left", {
        orgId: auth.user.organizationId,
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
