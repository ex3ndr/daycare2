import { createId } from "@paralleldrive/cuid2";
import { Prisma, type ChatMember } from "@prisma/client";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { ApiError } from "@/apps/api/lib/apiError.js";
import { chatRecipientIdsResolve } from "@/apps/api/lib/chatRecipientIdsResolve.js";
import { databaseTransactionRun } from "@/modules/database/databaseTransactionRun.js";

type ChannelJoinInput = {
  organizationId: string;
  channelId: string;
  userId: string;
};

type ChannelJoinResult = {
  membership: ChatMember;
};

export async function channelJoin(
  context: ApiContext,
  input: ChannelJoinInput
): Promise<ChannelJoinResult> {
  const { channel, membership } = await databaseTransactionRun(context.db, async (tx) => {
    // Optimistic transaction: TOCTU between membership checks and writes is acceptable; unique constraints guard duplicates.
    const channel = await tx.chat.findFirst({
      where: {
        id: input.channelId,
        organizationId: input.organizationId,
        kind: "CHANNEL"
      }
    });

    if (!channel) {
      throw new ApiError(404, "NOT_FOUND", "Channel not found");
    }

    if (channel.visibility === "PRIVATE") {
      throw new ApiError(403, "FORBIDDEN", "Private channels require an invitation");
    }

    const activeMembership = await tx.chatMember.findFirst({
      where: {
        chatId: input.channelId,
        userId: input.userId,
        leftAt: null
      }
    });

    let membership: ChatMember;
    if (activeMembership) {
      membership = activeMembership;
    } else {
      const historicalMembership = await tx.chatMember.findFirst({
        where: {
          chatId: input.channelId,
          userId: input.userId
        },
        orderBy: {
          joinedAt: "desc"
        }
      });

      if (historicalMembership) {
        membership = await tx.chatMember.update({
          where: {
            id: historicalMembership.id
          },
          data: {
            leftAt: null,
            joinedAt: new Date()
          }
        });
      } else {
        try {
          membership = await tx.chatMember.create({
            data: {
              id: createId(),
              chatId: input.channelId,
              userId: input.userId,
              role: "MEMBER",
              notificationLevel: "ALL"
            }
          });
        } catch (error) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002"
          ) {
            const existing = await tx.chatMember.findFirst({
              where: {
                chatId: input.channelId,
                userId: input.userId
              },
              orderBy: {
                joinedAt: "desc"
              }
            });

            if (!existing) {
              throw error;
            }

            membership = existing;
          } else {
            throw error;
          }
        }
      }
    }

    return {
      channel,
      membership
    };
  });

  const recipients = await chatRecipientIdsResolve(context, input.channelId);
  await context.updates.publishToUsers(recipients, "channel.member.joined", {
    orgId: channel.organizationId,
    channelId: input.channelId,
    userId: input.userId
  });

  return {
    membership
  };
}
