import type { Chat } from "@prisma/client";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { ApiError } from "@/apps/api/lib/apiError.js";
import { chatRecipientIdsResolve } from "@/apps/api/lib/chatRecipientIdsResolve.js";
import { databaseTransactionRun } from "@/modules/database/databaseTransactionRun.js";

type ChannelUpdateInput = {
  organizationId: string;
  channelId: string;
  name?: string;
  topic?: string | null;
};

export async function channelUpdate(
  context: ApiContext,
  input: ChannelUpdateInput
): Promise<Chat> {
  const channel = await databaseTransactionRun(context.db, async (tx) => {
    // Optimistic transaction: TOCTU between channel lookup and update is acceptable here.
    const channelInOrg = await tx.chat.findFirst({
      where: {
        id: input.channelId,
        organizationId: input.organizationId,
        kind: "CHANNEL"
      },
      select: {
        id: true
      }
    });

    if (!channelInOrg) {
      throw new ApiError(404, "NOT_FOUND", "Channel not found");
    }

    return await tx.chat.update({
      where: {
        id: channelInOrg.id
      },
      data: {
        name: input.name,
        topic: input.topic
      }
    });
  });

  const recipients = await chatRecipientIdsResolve(context, channel.id);
  await context.updates.publishToUsers(recipients, "channel.updated", {
    orgId: channel.organizationId,
    channelId: channel.id
  });

  return channel;
}
