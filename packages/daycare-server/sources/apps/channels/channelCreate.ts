import { createId } from "@paralleldrive/cuid2";
import type { Chat } from "@prisma/client";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { organizationRecipientIdsResolve } from "@/apps/api/lib/organizationRecipientIdsResolve.js";

type ChannelCreateInput = {
  organizationId: string;
  userId: string;
  name: string;
  topic?: string | null;
  visibility: "public" | "private";
};

export async function channelCreate(
  context: ApiContext,
  input: ChannelCreateInput
): Promise<Chat> {
  const chat = await context.db.chat.create({
    data: {
      id: createId(),
      organizationId: input.organizationId,
      createdByUserId: input.userId,
      kind: "CHANNEL",
      name: input.name,
      topic: input.topic,
      visibility: input.visibility === "public" ? "PUBLIC" : "PRIVATE",
      members: {
        create: {
          id: createId(),
          userId: input.userId,
          role: "OWNER",
          notificationLevel: "ALL"
        }
      }
    }
  });

  const recipients = await organizationRecipientIdsResolve(context, chat.organizationId);
  await context.updates.publishToUsers(recipients, "channel.created", {
    orgId: chat.organizationId,
    channelId: chat.id
  });

  return chat;
}
