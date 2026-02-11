import type { ChatMember, ChatMemberRole } from "@prisma/client";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { ApiError } from "@/apps/api/lib/apiError.js";
import { chatRecipientIdsResolve } from "@/apps/api/lib/chatRecipientIdsResolve.js";
import { databaseTransactionRun } from "@/modules/database/databaseTransactionRun.js";

type ChannelMemberRoleSetInput = {
  organizationId: string;
  channelId: string;
  actorUserId: string;
  targetUserId: string;
  role: ChatMemberRole;
};

export async function channelMemberRoleSet(
  context: ApiContext,
  input: ChannelMemberRoleSetInput
): Promise<ChatMember> {
  if (input.actorUserId === input.targetUserId) {
    throw new ApiError(400, "VALIDATION_ERROR", "You cannot change your own role");
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
      throw new ApiError(403, "FORBIDDEN", "Only channel owners can change member roles");
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

    if (targetMembership.role === "OWNER" && input.role === "MEMBER") {
      const ownerCount = await tx.chatMember.count({
        where: {
          chatId: input.channelId,
          leftAt: null,
          role: "OWNER"
        }
      });

      if (ownerCount <= 1) {
        throw new ApiError(400, "VALIDATION_ERROR", "Channel must have at least one owner");
      }
    }

    return await tx.chatMember.update({
      where: {
        id: targetMembership.id
      },
      data: {
        role: input.role
      }
    });
  });

  const recipients = await chatRecipientIdsResolve(context, input.channelId);
  await context.updates.publishToUsers(recipients, "channel.member.updated", {
    orgId: input.organizationId,
    channelId: input.channelId,
    userId: input.targetUserId,
    role: input.role.toLowerCase()
  });

  return membership;
}
