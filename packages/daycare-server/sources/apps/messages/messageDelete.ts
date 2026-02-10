import type { Message } from "@prisma/client";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { ApiError } from "@/apps/api/lib/apiError.js";
import { chatMembershipEnsure } from "@/apps/api/lib/chatMembershipEnsure.js";
import { chatRecipientIdsResolve } from "@/apps/api/lib/chatRecipientIdsResolve.js";

type MessageDeleteInput = {
  organizationId: string;
  messageId: string;
  userId: string;
};

export async function messageDelete(
  context: ApiContext,
  input: MessageDeleteInput
): Promise<Message> {
  const message = await context.db.message.findUnique({
    where: {
      id: input.messageId
    }
  });

  if (!message || message.deletedAt) {
    throw new ApiError(404, "NOT_FOUND", "Message not found");
  }

  await chatMembershipEnsure(context, message.chatId, input.userId);

  if (message.senderUserId !== input.userId) {
    throw new ApiError(403, "FORBIDDEN", "Only author can delete message");
  }

  const updated = await context.db.message.update({
    where: {
      id: message.id
    },
    data: {
      deletedAt: new Date()
    }
  });

  const recipients = await chatRecipientIdsResolve(context, updated.chatId);
  await context.updates.publishToUsers(recipients, "message.deleted", {
    orgId: input.organizationId,
    channelId: updated.chatId,
    messageId: updated.id
  });

  return updated;
}
