import { createId } from "@paralleldrive/cuid2";
import type { Prisma } from "@prisma/client";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { ApiError } from "@/apps/api/lib/apiError.js";
import { aiBotWebhookDeliver } from "@/apps/ai/aiBotWebhookDeliver.js";
import { chatMembershipEnsure } from "@/apps/api/lib/chatMembershipEnsure.js";
import { chatRecipientIdsResolve } from "@/apps/api/lib/chatRecipientIdsResolve.js";
import { mentionUsernamesExtract } from "@/apps/messages/mentionUsernamesExtract.js";
import { databaseTransactionRun } from "@/modules/database/databaseTransactionRun.js";
import { getLogger } from "@/utils/getLogger.js";

type MessageWithRelations = Prisma.MessageGetPayload<{
  include: {
    senderUser: true;
    attachments: { include: { file: true } };
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

const logger = getLogger("messages.send");

const FILE_URL_PATTERN = /^\/api\/org\/([^/]+)\/files\/([^/?#]+)$/;

function fileIdFromAttachmentUrl(url: string, organizationId: string): string | null {
  const match = FILE_URL_PATTERN.exec(url);
  if (!match) return null;
  if (match[1] !== organizationId) return null;
  return match[2]!;
}

export async function messageSend(
  context: ApiContext,
  input: MessageSendInput
): Promise<MessageWithRelations> {
  await chatMembershipEnsure(context, input.channelId, input.userId);

  const chat = await context.db.chat.findFirst({
    where: {
      id: input.channelId,
      organizationId: input.organizationId
    },
    select: {
      archivedAt: true,
      kind: true
    }
  });

  if (!chat) {
    throw new ApiError(404, "NOT_FOUND", "Chat not found");
  }

  if (chat.archivedAt) {
    throw new ApiError(403, "FORBIDDEN", "Cannot send messages to archived channels");
  }

  // Resolve fileIds from attachment URLs and validate they exist in this org
  const candidateFileIds = (input.attachments ?? [])
    .map((a) => fileIdFromAttachmentUrl(a.url, input.organizationId))
    .filter((id): id is string => id !== null);

  const validFileIds = new Set<string>();
  if (candidateFileIds.length > 0) {
    const files = await context.db.fileAsset.findMany({
      where: {
        id: { in: candidateFileIds },
        organizationId: input.organizationId,
        status: "COMMITTED"
      },
      select: { id: true }
    });
    for (const f of files) {
      validFileIds.add(f.id);
    }
  }

  const threadId = input.threadId ?? null;
  const usernames = mentionUsernamesExtract(input.text);
  let mentionedBots: Array<{ id: string; webhookUrl: string }> = [];
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
            id: true,
            kind: true,
            webhookUrl: true
          }
        })
      : [];

    mentionedBots = mentionedUsers
      .filter((user) => user.kind === "AI" && user.webhookUrl)
      .map((user) => ({
        id: user.id,
        webhookUrl: user.webhookUrl as string
      }));

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
          create: (input.attachments ?? []).map((attachment, index) => {
            const extractedFileId = fileIdFromAttachmentUrl(attachment.url, input.organizationId);
            return {
              id: createId(),
              sortOrder: index,
              kind: attachment.kind,
              url: attachment.url,
              mimeType: attachment.mimeType,
              fileName: attachment.fileName,
              sizeBytes: attachment.sizeBytes,
              fileId: extractedFileId && validFileIds.has(extractedFileId) ? extractedFileId : null
            };
          })
        }
      },
      include: {
        senderUser: true,
        attachments: { include: { file: true } },
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

  if (message.senderUser.kind === "AI") {
    return message;
  }

  const botTargetsById = new Map<string, string>();
  for (const bot of mentionedBots) {
    botTargetsById.set(bot.id, bot.webhookUrl);
  }

  if (chat.kind === "DIRECT") {
    const dmBots = await context.db.chatMember.findMany({
      where: {
        chatId: input.channelId,
        leftAt: null,
        userId: {
          not: input.userId
        },
        user: {
          kind: "AI",
          webhookUrl: {
            not: null
          }
        }
      },
      include: {
        user: {
          select: {
            id: true,
            webhookUrl: true
          }
        }
      }
    });

    for (const member of dmBots) {
      if (member.user.webhookUrl) {
        botTargetsById.set(member.user.id, member.user.webhookUrl);
      }
    }
  }

  for (const [botId, webhookUrl] of botTargetsById) {
    if (botId === input.userId) {
      continue;
    }

    void aiBotWebhookDeliver({
      webhookUrl,
      payload: {
        event: "message.created",
        message: {
          id: message.id,
          chatId: message.chatId,
          senderUserId: message.senderUserId,
          threadId: message.threadId,
          text: message.text,
          createdAt: message.createdAt.getTime()
        },
        channel: {
          id: input.channelId,
          kind: chat.kind.toLowerCase()
        },
        mentionedBot: {
          id: botId
        }
      }
    }).then((delivered) => {
      if (!delivered) {
        logger.warn("ai webhook delivery failed", {
          botId,
          channelId: input.channelId,
          messageId: message.id
        });
      }
    }).catch((error: unknown) => {
      logger.warn("ai webhook delivery failed", {
        botId,
        channelId: input.channelId,
        messageId: message.id,
        error
      });
    });
  }

  return message;
}
