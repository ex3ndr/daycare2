import type { ChatMember } from "@prisma/client";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { ApiError } from "@/apps/api/lib/apiError.js";
import { chatRecipientIdsResolve } from "@/apps/api/lib/chatRecipientIdsResolve.js";
import { databaseTransactionRun } from "@/modules/database/databaseTransactionRun.js";

type ChannelMemberKickInput = {
  organizationId: string;
  channelId: string;
  actorUserId: string;
  targetUserId: string;
};

export async function channelMemberKick(
  context: ApiContext,
  input: ChannelMemberKickInput
): Promise<ChatMember> {
  if (input.actorUserId === input.targetUserId) {
    throw new ApiError(400, "VALIDATION_ERROR", "You cannot remove yourself");
  }

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

    const actorMembership = await tx.chatMember.findFirst({
      where: {
        chatId: input.channelId,
        userId: input.actorUserId,
        leftAt: null
      }
    });

    if (!actorMembership || actorMembership.role !== "OWNER") {
      throw new ApiError(403, "FORBIDDEN", "Only channel owners can remove members");
    }

    const targetMembership = await tx.chatMember.findFirst({
      where: {
        chatId: input.channelId,
        userId: input.targetUserId,
        leftAt: null
      }
    });

    if (!targetMembership) {
      throw new ApiError(404, "NOT_FOUND", "Member not found");
    }

    if (targetMembership.role === "OWNER") {
      throw new ApiError(403, "FORBIDDEN", "Channel owners cannot remove other owners");
    }

    return await tx.chatMember.update({
      where: {
        id: targetMembership.id
      },
      data: {
        leftAt: new Date()
      }
    });
  });

  const recipients = await chatRecipientIdsResolve(context, input.channelId);
  const recipientsWithTarget = Array.from(new Set([...recipients, input.targetUserId]));

  await context.updates.publishToUsers(recipientsWithTarget, "channel.member.left", {
    orgId: input.organizationId,
    channelId: input.channelId,
    userId: input.targetUserId
  });

  return membership;
}
