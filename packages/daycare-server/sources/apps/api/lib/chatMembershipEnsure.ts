import type { ChatMember } from "@prisma/client";
import type { ApiContext } from "./apiContext.js";
import { ApiError } from "./apiError.js";

export async function chatMembershipEnsure(
  context: ApiContext,
  chatId: string,
  userId: string
): Promise<ChatMember> {
  const membership = await context.db.chatMember.findFirst({
    where: {
      chatId,
      userId,
      leftAt: null
    }
  });

  if (!membership) {
    throw new ApiError(403, "FORBIDDEN", "Not a member of this chat");
  }

  return membership;
}
