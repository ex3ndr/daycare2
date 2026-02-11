import type { Chat } from "@prisma/client";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { ApiError } from "@/apps/api/lib/apiError.js";
import { chatRecipientIdsResolve } from "@/apps/api/lib/chatRecipientIdsResolve.js";
import { databaseTransactionRun } from "@/modules/database/databaseTransactionRun.js";

type ChannelUnarchiveInput = {
  organizationId: string;
  channelId: string;
  actorUserId: string;
};

export async function channelUnarchive(
  context: ApiContext,
  input: ChannelUnarchiveInput
): Promise<Chat> {
  const channel = await databaseTransactionRun(context.db, async (tx) => {
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

    if (!channel.archivedAt) {
      throw new ApiError(400, "VALIDATION_ERROR", "Channel is not archived");
    }

    const actorMembership = await tx.chatMember.findFirst({
      where: {
        chatId: input.channelId,
        userId: input.actorUserId,
        leftAt: null
      }
    });

    if (!actorMembership || actorMembership.role !== "OWNER") {
      throw new ApiError(403, "FORBIDDEN", "Only channel owners can unarchive channels");
    }

    return await tx.chat.update({
      where: {
        id: input.channelId
      },
      data: {
        archivedAt: null
      }
    });
  });

  const recipients = await chatRecipientIdsResolve(context, input.channelId);
  await context.updates.publishToUsers(recipients, "channel.updated", {
    orgId: input.organizationId,
    channelId: input.channelId
  });

  return channel;
}
