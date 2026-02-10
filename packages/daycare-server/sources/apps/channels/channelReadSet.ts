import type { ApiContext } from "@/apps/api/lib/apiContext.js";

type ChannelReadSetInput = {
  membershipId: string;
  readAt: Date;
};

export async function channelReadSet(
  context: ApiContext,
  input: ChannelReadSetInput
): Promise<void> {
  await context.db.chatMember.update({
    where: {
      id: input.membershipId
    },
    data: {
      lastReadAt: input.readAt
    }
  });
}
