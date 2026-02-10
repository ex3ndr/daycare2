import { createId } from "@paralleldrive/cuid2";
import type { ChatMember } from "@prisma/client";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { ApiError } from "@/apps/api/lib/apiError.js";
import { chatRecipientIdsResolve } from "@/apps/api/lib/chatRecipientIdsResolve.js";

type ChannelJoinInput = {
  organizationId: string;
  channelId: string;
  userId: string;
};

type ChannelJoinResult = {
  membership: ChatMember;
};

export async function channelJoin(
  context: ApiContext,
  input: ChannelJoinInput
): Promise<ChannelJoinResult> {
  const channel = await context.db.chat.findFirst({
    where: {
      id: input.channelId,
      organizationId: input.organizationId,
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
      chatId: input.channelId,
      userId: input.userId,
      leftAt: null
    }
  });

  let membership: ChatMember;
  if (activeMembership) {
    membership = activeMembership;
  } else {
    const historicalMembership = await context.db.chatMember.findFirst({
      where: {
        chatId: input.channelId,
        userId: input.userId
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
          chatId: input.channelId,
          userId: input.userId,
          role: "MEMBER",
          notificationLevel: "ALL"
        }
      });
    }
  }

  const recipients = await chatRecipientIdsResolve(context, input.channelId);
  await context.updates.publishToUsers(recipients, "channel.member.joined", {
    orgId: channel.organizationId,
    channelId: input.channelId,
    userId: input.userId
  });

  return {
    membership
  };
}
