import { createId } from "@paralleldrive/cuid2";
import { Prisma, type Chat } from "@prisma/client";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { ApiError } from "@/apps/api/lib/apiError.js";
import { databaseTransactionRun } from "@/modules/database/databaseTransactionRun.js";

type DirectCreateInput = {
  organizationId: string;
  userId: string;
  peerUserId: string;
};

function directKeyCreate(userIdA: string, userIdB: string): string {
  return [userIdA, userIdB].sort().join(":");
}

export async function directCreate(
  context: ApiContext,
  input: DirectCreateInput
): Promise<Chat> {
  if (input.userId === input.peerUserId) {
    throw new ApiError(400, "VALIDATION_ERROR", "Cannot create a direct chat with yourself");
  }

  const directKey = directKeyCreate(input.userId, input.peerUserId);

  const chat = await databaseTransactionRun(context.db, async (tx) => {
    const peerUser = await tx.user.findFirst({
      where: {
        id: input.peerUserId,
        organizationId: input.organizationId
      },
      select: {
        id: true
      }
    });

    if (!peerUser) {
      throw new ApiError(404, "NOT_FOUND", "User not found");
    }

    let chat = await tx.chat.findUnique({
      where: {
        directKey
      }
    });

    if (!chat) {
      try {
        chat = await tx.chat.create({
          data: {
            id: createId(),
            organizationId: input.organizationId,
            createdByUserId: input.userId,
            kind: "DIRECT",
            visibility: "PRIVATE",
            directKey
          }
        });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
          throw error;
        }

        chat = await tx.chat.findUnique({
          where: {
            directKey
          }
        });
      }
    }

    if (!chat) {
      throw new ApiError(500, "INTERNAL_ERROR", "Failed to create direct chat");
    }

    if (chat.organizationId !== input.organizationId || chat.kind !== "DIRECT") {
      throw new ApiError(409, "CONFLICT", "Direct chat key is already assigned");
    }

    for (const participantUserId of [input.userId, input.peerUserId]) {
      const membership = await tx.chatMember.findUnique({
        where: {
          chatId_userId: {
            chatId: chat.id,
            userId: participantUserId
          }
        }
      });

      if (!membership) {
        await tx.chatMember.create({
          data: {
            id: createId(),
            chatId: chat.id,
            userId: participantUserId,
            role: "MEMBER",
            notificationLevel: "ALL"
          }
        });
        continue;
      }

      if (membership.leftAt) {
        await tx.chatMember.update({
          where: {
            id: membership.id
          },
          data: {
            leftAt: null,
            joinedAt: new Date()
          }
        });
      }
    }

    return chat;
  });

  await context.updates.publishToUsers([input.userId, input.peerUserId], "channel.created", {
    orgId: input.organizationId,
    channelId: chat.id
  });

  return chat;
}
