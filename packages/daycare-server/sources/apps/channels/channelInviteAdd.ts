import { createId } from "@paralleldrive/cuid2";
import { Prisma, type ChatMember } from "@prisma/client";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { ApiError } from "@/apps/api/lib/apiError.js";
import { chatRecipientIdsResolve } from "@/apps/api/lib/chatRecipientIdsResolve.js";
import { databaseTransactionRun } from "@/modules/database/databaseTransactionRun.js";

type ChannelInviteAddInput = {
  organizationId: string;
  channelId: string;
  actorUserId: string;
  targetUserId: string;
};

export async function channelInviteAdd(
  context: ApiContext,
  input: ChannelInviteAddInput
): Promise<ChatMember> {
  let isNew = false;

  const membership = await databaseTransactionRun(context.db, async (tx) => {
    const channel = await tx.chat.findFirst({
      where: {
        id: input.channelId,
        organizationId: input.organizationId,
        kind: "CHANNEL"
      }
    });

    if (!channel) {
      throw new ApiError(404, "NOT_FOUND", "Channel not found");
    }

    if (channel.archivedAt !== null) {
      throw new ApiError(400, "VALIDATION_ERROR", "Cannot add members to an archived channel");
    }

    if (channel.visibility !== "PRIVATE") {
      throw new ApiError(400, "VALIDATION_ERROR", "Only private channels support member invitations");
    }

    // Verify actor is channel owner
    const actorMembership = await tx.chatMember.findFirst({
      where: {
        chatId: input.channelId,
        userId: input.actorUserId,
        leftAt: null
      }
    });

    if (!actorMembership || actorMembership.role !== "OWNER") {
      throw new ApiError(403, "FORBIDDEN", "Only channel owners can add members");
    }

    // Verify target user is an active org member
    const targetUser = await tx.user.findFirst({
      where: {
        id: input.targetUserId,
        organizationId: input.organizationId
      }
    });

    if (!targetUser) {
      throw new ApiError(404, "NOT_FOUND", "User not found in this organization");
    }

    if (targetUser.deactivatedAt !== null) {
      throw new ApiError(403, "FORBIDDEN", "Cannot add a deactivated user");
    }

    // Check if user already has an active membership
    const activeMembership = await tx.chatMember.findFirst({
      where: {
        chatId: input.channelId,
        userId: input.targetUserId,
        leftAt: null
      }
    });

    if (activeMembership) {
      return activeMembership;
    }

    // Reactivate historical membership or create new one
    const historicalMembership = await tx.chatMember.findFirst({
      where: {
        chatId: input.channelId,
        userId: input.targetUserId
      },
      orderBy: {
        joinedAt: "desc"
      }
    });

    if (historicalMembership) {
      isNew = true;
      return await tx.chatMember.update({
        where: { id: historicalMembership.id },
        data: {
          leftAt: null,
          joinedAt: new Date()
        }
      });
    }

    try {
      isNew = true;
      return await tx.chatMember.create({
        data: {
          id: createId(),
          chatId: input.channelId,
          userId: input.targetUserId,
          role: "MEMBER",
          notificationLevel: "ALL"
        }
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const existing = await tx.chatMember.findFirst({
          where: {
            chatId: input.channelId,
            userId: input.targetUserId
          },
          orderBy: {
            joinedAt: "desc"
          }
        });

        if (!existing) {
          throw error;
        }

        return existing;
      }

      throw error;
    }
  });

  if (isNew) {
    const recipients = await chatRecipientIdsResolve(context, input.channelId);
    await context.updates.publishToUsers(recipients, "channel.member.joined", {
      orgId: input.organizationId,
      channelId: input.channelId,
      userId: input.targetUserId
    });
  }

  return membership;
}
