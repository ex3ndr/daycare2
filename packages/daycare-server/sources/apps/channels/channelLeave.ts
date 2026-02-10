import type { ChatMember } from "@prisma/client";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { ApiError } from "@/apps/api/lib/apiError.js";
import { chatRecipientIdsResolve } from "@/apps/api/lib/chatRecipientIdsResolve.js";

type ChannelLeaveInput = {
  organizationId: string;
  channelId: string;
  userId: string;
};

export async function channelLeave(
  context: ApiContext,
  input: ChannelLeaveInput
): Promise<ChatMember> {
  const existing = await context.db.chatMember.findFirst({
    where: {
      chatId: input.channelId,
      userId: input.userId,
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

  const recipients = await chatRecipientIdsResolve(context, input.channelId);
  await context.updates.publishToUsers(recipients, "channel.member.left", {
    orgId: input.organizationId,
    channelId: input.channelId,
    userId: input.userId
  });

  return membership;
}
