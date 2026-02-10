import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { ApiError } from "@/apps/api/lib/apiError.js";
import { chatMembershipEnsure } from "@/apps/api/lib/chatMembershipEnsure.js";
import { chatRecipientIdsResolve } from "@/apps/api/lib/chatRecipientIdsResolve.js";

type MessageReactionRemoveInput = {
  organizationId: string;
  messageId: string;
  userId: string;
  shortcode: string;
};

export async function messageReactionRemove(
  context: ApiContext,
  input: MessageReactionRemoveInput
): Promise<void> {
  const message = await context.db.message.findUnique({
    where: {
      id: input.messageId
    }
  });

  if (!message || message.deletedAt) {
    throw new ApiError(404, "NOT_FOUND", "Message not found");
  }

  await chatMembershipEnsure(context, message.chatId, input.userId);

  await context.db.messageReaction.deleteMany({
    where: {
      messageId: message.id,
      userId: input.userId,
      shortcode: input.shortcode
    }
  });

  const recipients = await chatRecipientIdsResolve(context, message.chatId);
  await context.updates.publishToUsers(recipients, "message.reaction", {
    orgId: input.organizationId,
    channelId: message.chatId,
    messageId: message.id,
    action: "remove",
    userId: input.userId,
    shortcode: input.shortcode
  });
}
