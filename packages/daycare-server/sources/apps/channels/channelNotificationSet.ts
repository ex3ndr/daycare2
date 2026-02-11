import type { ChatMember } from "@prisma/client";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { ApiError } from "@/apps/api/lib/apiError.js";

type ChannelNotificationLevel = "ALL" | "MENTIONS_ONLY" | "MUTED";

type ChannelNotificationSetInput = {
  organizationId: string;
  channelId: string;
  userId: string;
  level: ChannelNotificationLevel;
  muteUntil?: number;
};

export async function channelNotificationSet(
  context: ApiContext,
  input: ChannelNotificationSetInput
): Promise<ChatMember> {
  const membership = await context.db.chatMember.findFirst({
    where: {
      chatId: input.channelId,
      userId: input.userId,
      leftAt: null,
      chat: {
        organizationId: input.organizationId
      }
    }
  });

  if (!membership) {
    throw new ApiError(404, "NOT_FOUND", "Membership not found");
  }

  if (input.level === "MUTED" && input.muteUntil !== undefined && input.muteUntil <= Date.now()) {
    throw new ApiError(400, "VALIDATION_ERROR", "muteUntil must be in the future");
  }

  return await context.db.chatMember.update({
    where: {
      id: membership.id
    },
    data: {
      notificationLevel: input.level,
      muteForever: input.level === "MUTED" && input.muteUntil === undefined,
      muteUntil: input.level === "MUTED" && input.muteUntil !== undefined
        ? new Date(input.muteUntil)
        : null
    }
  });
}
