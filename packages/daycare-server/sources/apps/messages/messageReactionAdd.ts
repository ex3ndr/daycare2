import { createId } from "@paralleldrive/cuid2";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { ApiError } from "@/apps/api/lib/apiError.js";
import { chatMembershipEnsure } from "@/apps/api/lib/chatMembershipEnsure.js";
import { chatRecipientIdsResolve } from "@/apps/api/lib/chatRecipientIdsResolve.js";

type MessageReactionAddInput = {
  organizationId: string;
  messageId: string;
  userId: string;
  shortcode: string;
};

export async function messageReactionAdd(
  context: ApiContext,
  input: MessageReactionAddInput
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

  await context.db.messageReaction.upsert({
    where: {
      messageId_userId_shortcode: {
        messageId: message.id,
        userId: input.userId,
        shortcode: input.shortcode
      }
    },
    create: {
      id: createId(),
      messageId: message.id,
      userId: input.userId,
      shortcode: input.shortcode
    },
    update: {}
  });

  const recipients = await chatRecipientIdsResolve(context, message.chatId);
  await context.updates.publishToUsers(recipients, "message.reaction", {
    orgId: input.organizationId,
    channelId: message.chatId,
    messageId: message.id,
    action: "add",
    userId: input.userId,
    shortcode: input.shortcode
  });
}
