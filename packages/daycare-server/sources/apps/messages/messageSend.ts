import { createId } from "@paralleldrive/cuid2";
import type { Prisma } from "@prisma/client";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { ApiError } from "@/apps/api/lib/apiError.js";
import { chatMembershipEnsure } from "@/apps/api/lib/chatMembershipEnsure.js";
import { chatRecipientIdsResolve } from "@/apps/api/lib/chatRecipientIdsResolve.js";
import { mentionUsernamesExtract } from "@/apps/messages/mentionUsernamesExtract.js";
import { databaseTransactionRun } from "@/modules/database/databaseTransactionRun.js";

type MessageWithRelations = Prisma.MessageGetPayload<{
  include: {
    senderUser: true;
    attachments: true;
    reactions: true;
  };
}>;

type MessageSendInput = {
  organizationId: string;
  channelId: string;
  userId: string;
  text: string;
  threadId?: string | null;
  attachments?: Array<{
    kind: string;
    url: string;
    mimeType?: string | null;
    fileName?: string | null;
    sizeBytes?: number | null;
  }>;
};

export async function messageSend(
  context: ApiContext,
  input: MessageSendInput
): Promise<MessageWithRelations> {
  await chatMembershipEnsure(context, input.channelId, input.userId);

  const threadId = input.threadId ?? null;
  const usernames = mentionUsernamesExtract(input.text);
  const message = await databaseTransactionRun(context.db, async (tx) => {
    // Optimistic transaction: TOCTU between thread checks and writes is acceptable.
    if (threadId) {
      const root = await tx.message.findFirst({
        where: {
          id: threadId,
          chatId: input.channelId
        }
      });

      if (!root) {
        throw new ApiError(404, "NOT_FOUND", "Thread root message not found");
      }

      await tx.thread.upsert({
        where: {
          id: threadId
        },
        create: {
          id: threadId,
          chatId: input.channelId
        },
        update: {
          updatedAt: new Date()
        }
      });
    }

    const mentionedUsers = usernames.length > 0
      ? await tx.user.findMany({
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

    const message = await tx.message.create({
      data: {
        id: createId(),
        chatId: input.channelId,
        senderUserId: input.userId,
        threadId,
        text: input.text,
        mentions: {
          create: mentionedUsers.map((mentionedUser) => ({
            id: createId(),
            mentionedUserId: mentionedUser.id
          }))
        },
        attachments: {
          create: (input.attachments ?? []).map((attachment, index) => ({
            id: createId(),
            sortOrder: index,
            kind: attachment.kind,
            url: attachment.url,
            mimeType: attachment.mimeType,
            fileName: attachment.fileName,
            sizeBytes: attachment.sizeBytes
          }))
        }
      },
      include: {
        senderUser: true,
        attachments: true,
        reactions: true
      }
    });

    if (threadId) {
      await tx.message.update({
        where: {
          id: threadId
        },
        data: {
          threadReplyCount: {
            increment: 1
          },
          threadLastReplyAt: message.createdAt
        }
      });
    }

    return message;
  });

  const recipients = await chatRecipientIdsResolve(context, message.chatId);
  await context.updates.publishToUsers(recipients, "message.created", {
    orgId: input.organizationId,
    channelId: message.chatId,
    messageId: message.id
  });

  return message;
}
