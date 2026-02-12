import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { isCuid } from "@paralleldrive/cuid2";
import { z } from "zod";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { messageDelete } from "@/apps/messages/messageDelete.js";
import { messageEdit } from "@/apps/messages/messageEdit.js";
import { messageReactionAdd } from "@/apps/messages/messageReactionAdd.js";
import { messageReactionRemove } from "@/apps/messages/messageReactionRemove.js";
import { messageSend } from "@/apps/messages/messageSend.js";
import { ApiError } from "@/apps/api/lib/apiError.js";
import { apiResponseOk } from "@/apps/api/lib/apiResponseOk.js";
import { authContextResolve } from "@/apps/api/lib/authContextResolve.js";
import { chatMembershipEnsure } from "@/apps/api/lib/chatMembershipEnsure.js";
import { idempotencyGuard } from "@/apps/api/lib/idempotencyGuard.js";
import { rateLimitMiddleware } from "@/apps/api/lib/rateLimitMiddleware.js";

const messageListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.string().min(1).optional(),
  after: z.string().min(1).optional(),
  around: z.string().min(1).optional(),
  threadId: z.string().min(1).nullable().optional()
});

const messageSendBodySchema = z.object({
  messageId: z.string().trim().min(1).refine((value) => isCuid(value), "Invalid messageId"),
  channelId: z.string().min(1),
  text: z.string().max(10000),
  threadId: z.string().min(1).nullable().optional(),
  attachments: z.array(z.object({
    kind: z.string().min(1),
    fileId: z.string().trim().min(1),
    mimeType: z.string().nullable().optional(),
    fileName: z.string().nullable().optional(),
    sizeBytes: z.number().int().positive().nullable().optional()
  })).max(10).optional()
}).superRefine((input, ctx) => {
  const hasText = input.text.trim().length > 0;
  const hasAttachments = (input.attachments?.length ?? 0) > 0;
  if (hasText || hasAttachments) return;
  ctx.addIssue({
    code: z.ZodIssueCode.too_small,
    minimum: 1,
    type: "string",
    inclusive: true,
    exact: false,
    message: "String must contain at least 1 character(s)",
    path: ["text"]
  });
});

const messageEditBodySchema = z.object({
  text: z.string().trim().min(1).max(10000)
});

const reactionBodySchema = z.object({
  shortcode: z.string().trim().min(3).max(128)
});

type MessageWithRelations = Prisma.MessageGetPayload<{
  include: {
    senderUser: true;
    attachments: { include: { file: true } };
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
        sortOrder: attachment.sortOrder,
        imageWidth: attachment.file?.imageWidth ?? null,
        imageHeight: attachment.file?.imageHeight ?? null,
        imageThumbhash: attachment.file?.imageThumbhash ?? null
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
  const messageSendRateLimit = rateLimitMiddleware(context, {
    scope: "messages.send",
    limit: 30,
    windowSeconds: 60,
    keyCreate: async (request) => {
      const params = z.object({ orgid: z.string().min(1) }).parse(request.params);
      const auth = await authContextResolve(request, context, params.orgid);
      return auth.user.id;
    },
    message: "Too many messages. Please retry later."
  });

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
          attachments: { include: { file: true } },
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
          attachments: { include: { file: true } },
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
          attachments: { include: { file: true } },
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
          attachments: { include: { file: true } },
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
        attachments: { include: { file: true } },
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

  app.post("/api/org/:orgid/messages/send", async (request, reply) => {
    const allowed = await messageSendRateLimit(request, reply);
    if (!allowed) {
      return;
    }

    const params = z.object({ orgid: z.string().min(1) }).parse(request.params);
    const body = messageSendBodySchema.parse(request.body);
    const auth = await authContextResolve(request, context, params.orgid);

    return await idempotencyGuard(request, context, { type: "user", id: auth.user.id }, async () => {
      const message = await messageSend(context, {
        messageId: body.messageId,
        organizationId: params.orgid,
        channelId: body.channelId,
        userId: auth.user.id,
        text: body.text.trim(),
        threadId: body.threadId,
        attachments: body.attachments
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
      const updated = await messageEdit(context, {
        organizationId: params.orgid,
        messageId: params.messageId,
        userId: auth.user.id,
        text: body.text
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
      const updated = await messageDelete(context, {
        organizationId: params.orgid,
        messageId: params.messageId,
        userId: auth.user.id
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
      await messageReactionAdd(context, {
        organizationId: params.orgid,
        messageId: params.messageId,
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
      await messageReactionRemove(context, {
        organizationId: params.orgid,
        messageId: params.messageId,
        userId: auth.user.id,
        shortcode: body.shortcode
      });

      return apiResponseOk({
        removed: true
      });
    });
  });
}
