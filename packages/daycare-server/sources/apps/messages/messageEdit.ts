import { createId } from "@paralleldrive/cuid2";
import type { Prisma } from "@prisma/client";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { ApiError } from "@/apps/api/lib/apiError.js";
import { chatMembershipEnsure } from "@/apps/api/lib/chatMembershipEnsure.js";
import { chatRecipientIdsResolve } from "@/apps/api/lib/chatRecipientIdsResolve.js";
import { mentionUsernamesExtract } from "@/apps/messages/mentionUsernamesExtract.js";

type MessageWithRelations = Prisma.MessageGetPayload<{
  include: {
    senderUser: true;
    attachments: true;
    reactions: true;
  };
}>;

type MessageEditInput = {
  organizationId: string;
  messageId: string;
  userId: string;
  text: string;
};

export async function messageEdit(
  context: ApiContext,
  input: MessageEditInput
): Promise<MessageWithRelations> {
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
    throw new ApiError(403, "FORBIDDEN", "Only author can edit message");
  }

  const usernames = mentionUsernamesExtract(input.text);
  const mentionedUsers = usernames.length > 0
    ? await context.db.user.findMany({
        where: {
          organizationId: input.organizationId,
          username: {
            in: usernames
          }
        },
        select: {
          id: true
        }
      })
    : [];

  const updated = await context.db.message.update({
    where: {
      id: message.id
    },
    data: {
      text: input.text,
      editedAt: new Date(),
      mentions: {
        deleteMany: {},
        create: mentionedUsers.map((mentionedUser) => ({
          id: createId(),
          mentionedUserId: mentionedUser.id
        }))
      }
    },
    include: {
      senderUser: true,
      attachments: true,
      reactions: true
    }
  });

  const recipients = await chatRecipientIdsResolve(context, updated.chatId);
  await context.updates.publishToUsers(recipients, "message.updated", {
    orgId: input.organizationId,
    channelId: updated.chatId,
    messageId: updated.id
  });

  return updated;
}
