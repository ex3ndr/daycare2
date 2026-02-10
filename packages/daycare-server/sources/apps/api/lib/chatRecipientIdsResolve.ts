import type { ApiContext } from "./apiContext.js";

export async function chatRecipientIdsResolve(context: ApiContext, chatId: string): Promise<string[]> {
  const members = await context.db.chatMember.findMany({
    where: {
      chatId,
      leftAt: null
    },
    select: {
      userId: true
    }
  });

  return members.map((member) => member.userId);
}
