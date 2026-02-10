import { createId } from "@paralleldrive/cuid2";
import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { ApiError } from "@/apps/api/lib/apiError.js";
import { apiResponseOk } from "@/apps/api/lib/apiResponseOk.js";
import { authContextResolve } from "@/apps/api/lib/authContextResolve.js";
import { chatMembershipEnsure } from "@/apps/api/lib/chatMembershipEnsure.js";
import { chatRecipientIdsResolve } from "@/apps/api/lib/chatRecipientIdsResolve.js";
import { idempotencyGuard } from "@/apps/api/lib/idempotencyGuard.js";

const messageListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.string().min(1).optional(),
  after: z.string().min(1).optional(),
  around: z.string().min(1).optional(),
  threadId: z.string().min(1).nullable().optional()
});

const messageSendBodySchema = z.object({
  channelId: z.string().min(1),
  text: z.string().trim().min(1).max(10000),
  threadId: z.string().min(1).nullable().optional(),
  attachments: z.array(z.object({
    kind: z.string().min(1),
    url: z.string().url(),
    mimeType: z.string().nullable().optional(),
    fileName: z.string().nullable().optional(),
    sizeBytes: z.number().int().positive().nullable().optional()
  })).max(10).optional()
});

const messageEditBodySchema = z.object({
  text: z.string().trim().min(1).max(10000)
});

const reactionBodySchema = z.object({
  shortcode: z.string().trim().min(3).max(128)
});

function mentionUsernamesExtract(text: string): string[] {
  const matches = text.matchAll(/@([a-zA-Z0-9._-]+)/g);
  const usernames = new Set<string>();

  for (const match of matches) {
    const username = match[1]?.trim();
    if (username && username.length > 0) {
      usernames.add(username);
    }
  }

  return Array.from(usernames);
}

type MessageWithRelations = Prisma.MessageGetPayload<{
  include: {
    senderUser: true;
    attachments: true;
    reactions: true;
  };
}>;

function messageSerialize(message: MessageWithRelations) {
  return {
    id: message.id,
    chatId: message.chatId,
    senderUserId: message.senderUserId,
    threadId: message.threadId,
    text: message.text,
    createdAt: message.createdAt.getTime(),
    editedAt: message.editedAt?.getTime() ?? null,
    deletedAt: message.deletedAt?.getTime() ?? null,
    threadReplyCount: message.threadReplyCount,
    threadLastReplyAt: message.threadLastReplyAt?.getTime() ?? null,
    sender: {
      id: message.senderUser.id,
      kind: message.senderUser.kind.toLowerCase(),
      username: message.senderUser.username,
      firstName: message.senderUser.firstName,
      lastName: message.senderUser.lastName,
      avatarUrl: message.senderUser.avatarUrl
    },
    attachments: message.attachments
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((attachment) => ({
        id: attachment.id,
        kind: attachment.kind,
        url: attachment.url,
        mimeType: attachment.mimeType,
        fileName: attachment.fileName,
        sizeBytes: attachment.sizeBytes,
        sortOrder: attachment.sortOrder
      })),
    reactions: message.reactions.map((reaction) => ({
      id: reaction.id,
      userId: reaction.userId,
      shortcode: reaction.shortcode,
      createdAt: reaction.createdAt.getTime()
    }))
  };
}

export async function messageRoutesRegister(app: FastifyInstance, context: ApiContext): Promise<void> {
  app.get("/api/org/:orgid/channels/:channelId/messages", async (request) => {
    const params = z.object({ orgid: z.string().min(1), channelId: z.string().min(1) }).parse(request.params);
    const query = messageListQuerySchema.parse(request.query);
    const auth = await authContextResolve(request, context, params.orgid);

    await chatMembershipEnsure(context, params.channelId, auth.user.id);

    const threadIdFilter = query.threadId === undefined ? null : query.threadId;

    if (query.around) {
      const center = await context.db.message.findUnique({
        where: {
          id: query.around
        }
      });

      if (!center) {
        throw new ApiError(404, "NOT_FOUND", "Center message not found");
      }

      const half = Math.max(1, Math.floor(query.limit / 2));

      const before = await context.db.message.findMany({
        where: {
          chatId: params.channelId,
          threadId: threadIdFilter,
          deletedAt: null,
          createdAt: {
            lt: center.createdAt
          }
        },
        include: {
          senderUser: true,
          attachments: true,
          reactions: true
        },
        orderBy: {
          createdAt: "desc"
        },
        take: half
      });

      const after = await context.db.message.findMany({
        where: {
          chatId: params.channelId,
          threadId: threadIdFilter,
          deletedAt: null,
          createdAt: {
            gte: center.createdAt
          }
        },
        include: {
          senderUser: true,
          attachments: true,
          reactions: true
        },
        orderBy: {
          createdAt: "asc"
        },
        take: query.limit - half
      });

      return apiResponseOk({
        messages: [...before.reverse(), ...after].map((message) => messageSerialize(message))
      });
    }

    if (query.before) {
      const anchor = await context.db.message.findUnique({
        where: {
          id: query.before
        }
      });

      if (!anchor) {
        throw new ApiError(404, "NOT_FOUND", "Anchor message not found");
      }

      const messages = await context.db.message.findMany({
        where: {
          chatId: params.channelId,
          threadId: threadIdFilter,
          deletedAt: null,
          createdAt: {
            lt: anchor.createdAt
          }
        },
        include: {
          senderUser: true,
          attachments: true,
          reactions: true
        },
        orderBy: {
          createdAt: "desc"
        },
        take: query.limit
      });

      return apiResponseOk({
        messages: messages.reverse().map((message) => messageSerialize(message))
      });
    }

    if (query.after) {
      const anchor = await context.db.message.findUnique({
        where: {
          id: query.after
        }
      });

      if (!anchor) {
        throw new ApiError(404, "NOT_FOUND", "Anchor message not found");
      }

      const messages = await context.db.message.findMany({
        where: {
          chatId: params.channelId,
          threadId: threadIdFilter,
          deletedAt: null,
          createdAt: {
            gt: anchor.createdAt
          }
        },
        include: {
          senderUser: true,
          attachments: true,
          reactions: true
        },
        orderBy: {
          createdAt: "asc"
        },
        take: query.limit
      });

      return apiResponseOk({
        messages: messages.map((message) => messageSerialize(message))
      });
    }

    const newest = await context.db.message.findMany({
      where: {
        chatId: params.channelId,
        threadId: threadIdFilter,
        deletedAt: null
      },
      include: {
        senderUser: true,
        attachments: true,
        reactions: true
      },
      orderBy: {
        createdAt: "desc"
      },
      take: query.limit
    });

    return apiResponseOk({
      messages: newest.reverse().map((message) => messageSerialize(message))
    });
  });

  app.post("/api/org/:orgid/messages/send", async (request) => {
    const params = z.object({ orgid: z.string().min(1) }).parse(request.params);
    const body = messageSendBodySchema.parse(request.body);
    const auth = await authContextResolve(request, context, params.orgid);

    return await idempotencyGuard(request, context, { type: "user", id: auth.user.id }, async () => {
      await chatMembershipEnsure(context, body.channelId, auth.user.id);

      const threadId = body.threadId ?? null;
      if (threadId) {
        const root = await context.db.message.findFirst({
          where: {
            id: threadId,
            chatId: body.channelId
          }
        });

        if (!root) {
          throw new ApiError(404, "NOT_FOUND", "Thread root message not found");
        }

        await context.db.thread.upsert({
          where: {
            id: threadId
          },
          create: {
            id: threadId,
            chatId: body.channelId
          },
          update: {
            updatedAt: new Date()
          }
        });
      }

      const usernames = mentionUsernamesExtract(body.text);
      const mentionedUsers = usernames.length > 0
        ? await context.db.user.findMany({
            where: {
              organizationId: params.orgid,
              username: {
                in: usernames
              }
            },
            select: {
              id: true
            }
          })
        : [];

      const message = await context.db.message.create({
        data: {
          id: createId(),
          chatId: body.channelId,
          senderUserId: auth.user.id,
          threadId,
          text: body.text,
          mentions: {
            create: mentionedUsers.map((mentionedUser) => ({
              id: createId(),
              mentionedUserId: mentionedUser.id
            }))
          },
          attachments: {
            create: (body.attachments ?? []).map((attachment, index) => ({
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
        await context.db.message.update({
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

      const recipients = await chatRecipientIdsResolve(context, message.chatId);
      await context.updates.publishToUsers(recipients, "message.created", {
        orgId: params.orgid,
        channelId: message.chatId,
        messageId: message.id
      });

      return apiResponseOk({
        message: messageSerialize(message)
      });
    });
  });

  app.post("/api/org/:orgid/messages/:messageId/edit", async (request) => {
    const params = z.object({ orgid: z.string().min(1), messageId: z.string().min(1) }).parse(request.params);
    const body = messageEditBodySchema.parse(request.body);
    const auth = await authContextResolve(request, context, params.orgid);

    return await idempotencyGuard(request, context, { type: "user", id: auth.user.id }, async () => {
      const message = await context.db.message.findUnique({
        where: {
          id: params.messageId
        }
      });

      if (!message || message.deletedAt) {
        throw new ApiError(404, "NOT_FOUND", "Message not found");
      }

      await chatMembershipEnsure(context, message.chatId, auth.user.id);

      if (message.senderUserId !== auth.user.id) {
        throw new ApiError(403, "FORBIDDEN", "Only author can edit message");
      }

      const usernames = mentionUsernamesExtract(body.text);
      const mentionedUsers = usernames.length > 0
        ? await context.db.user.findMany({
            where: {
              organizationId: params.orgid,
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
          text: body.text,
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
        orgId: params.orgid,
        channelId: updated.chatId,
        messageId: updated.id
      });

      return apiResponseOk({
        message: messageSerialize(updated)
      });
    });
  });

  app.post("/api/org/:orgid/messages/:messageId/delete", async (request) => {
    const params = z.object({ orgid: z.string().min(1), messageId: z.string().min(1) }).parse(request.params);
    const auth = await authContextResolve(request, context, params.orgid);

    return await idempotencyGuard(request, context, { type: "user", id: auth.user.id }, async () => {
      const message = await context.db.message.findUnique({
        where: {
          id: params.messageId
        }
      });

      if (!message || message.deletedAt) {
        throw new ApiError(404, "NOT_FOUND", "Message not found");
      }

      await chatMembershipEnsure(context, message.chatId, auth.user.id);

      if (message.senderUserId !== auth.user.id) {
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
        orgId: params.orgid,
        channelId: updated.chatId,
        messageId: updated.id
      });

      return apiResponseOk({
        deleted: true,
        messageId: updated.id
      });
    });
  });

  app.post("/api/org/:orgid/messages/:messageId/reactions/add", async (request) => {
    const params = z.object({ orgid: z.string().min(1), messageId: z.string().min(1) }).parse(request.params);
    const body = reactionBodySchema.parse(request.body);
    const auth = await authContextResolve(request, context, params.orgid);

    return await idempotencyGuard(request, context, { type: "user", id: auth.user.id }, async () => {
      const message = await context.db.message.findUnique({
        where: {
          id: params.messageId
        }
      });

      if (!message || message.deletedAt) {
        throw new ApiError(404, "NOT_FOUND", "Message not found");
      }

      await chatMembershipEnsure(context, message.chatId, auth.user.id);

      await context.db.messageReaction.upsert({
        where: {
          messageId_userId_shortcode: {
            messageId: message.id,
            userId: auth.user.id,
            shortcode: body.shortcode
          }
        },
        create: {
          id: createId(),
          messageId: message.id,
          userId: auth.user.id,
          shortcode: body.shortcode
        },
        update: {}
      });

      const recipients = await chatRecipientIdsResolve(context, message.chatId);
      await context.updates.publishToUsers(recipients, "message.reaction", {
        orgId: params.orgid,
        channelId: message.chatId,
        messageId: message.id,
        action: "add",
        userId: auth.user.id,
        shortcode: body.shortcode
      });

      return apiResponseOk({
        added: true
      });
    });
  });

  app.post("/api/org/:orgid/messages/:messageId/reactions/remove", async (request) => {
    const params = z.object({ orgid: z.string().min(1), messageId: z.string().min(1) }).parse(request.params);
    const body = reactionBodySchema.parse(request.body);
    const auth = await authContextResolve(request, context, params.orgid);

    return await idempotencyGuard(request, context, { type: "user", id: auth.user.id }, async () => {
      const message = await context.db.message.findUnique({
        where: {
          id: params.messageId
        }
      });

      if (!message || message.deletedAt) {
        throw new ApiError(404, "NOT_FOUND", "Message not found");
      }

      await chatMembershipEnsure(context, message.chatId, auth.user.id);

      await context.db.messageReaction.deleteMany({
        where: {
          messageId: message.id,
          userId: auth.user.id,
          shortcode: body.shortcode
        }
      });

      const recipients = await chatRecipientIdsResolve(context, message.chatId);
      await context.updates.publishToUsers(recipients, "message.reaction", {
        orgId: params.orgid,
        channelId: message.chatId,
        messageId: message.id,
        action: "remove",
        userId: auth.user.id,
        shortcode: body.shortcode
      });

      return apiResponseOk({
        removed: true
      });
    });
  });
}
