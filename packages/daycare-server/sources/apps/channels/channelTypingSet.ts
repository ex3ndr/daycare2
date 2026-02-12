import type { ApiContext } from "@/apps/api/lib/apiContext.js";

const TYPING_TTL_SECONDS = 5;

type ChannelTypingSetInput = {
  organizationId: string;
  channelId: string;
  userId: string;
  username: string;
  firstName: string;
  threadRootMessageId?: string | null;
};

type ChannelTypingSetResult = {
  expiresAt: number;
};

export async function channelTypingSet(
  context: ApiContext,
  input: ChannelTypingSetInput
): Promise<ChannelTypingSetResult> {
  const expiresAt = new Date(Date.now() + TYPING_TTL_SECONDS * 1000);

  await context.db.chatTypingState.upsert({
    where: {
      chatId_userId: {
        chatId: input.channelId,
        userId: input.userId
      }
    },
    create: {
      id: `${input.channelId}:${input.userId}`,
      chatId: input.channelId,
      userId: input.userId,
      expiresAt
    },
    update: {
      expiresAt
    }
  });

  const redisKey = `typing:${input.organizationId}:${input.channelId}:${input.userId}`;
  await context.redis.set(redisKey, input.threadRootMessageId ?? "", "EX", TYPING_TTL_SECONDS);

  const recipients = await context.db.chatMember.findMany({
    where: {
      chatId: input.channelId,
      leftAt: null
    },
    select: {
      userId: true
    }
  });

  await context.updates.publishEphemeralToUsers(recipients.map((item) => item.userId), "user.typing", {
    orgId: input.organizationId,
    chatId: input.channelId,
    channelId: input.channelId,
    userId: input.userId,
    username: input.username,
    firstName: input.firstName,
    threadRootMessageId: input.threadRootMessageId ?? null,
    expiresAt: expiresAt.getTime()
  });

  return {
    expiresAt: expiresAt.getTime()
  };
}
