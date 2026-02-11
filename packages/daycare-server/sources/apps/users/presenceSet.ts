import { organizationRecipientIdsResolve } from "@/apps/api/lib/organizationRecipientIdsResolve.js";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";

const PRESENCE_TTL_SECONDS = 90;

type PresenceSetInput = {
  organizationId: string;
  userId: string;
  status: "online" | "away";
};

function presenceKeyCreate(organizationId: string, userId: string): string {
  return `presence:${organizationId}:${userId}`;
}

export async function presenceSet(
  context: ApiContext,
  input: PresenceSetInput
): Promise<"online" | "away"> {
  await context.redis.set(
    presenceKeyCreate(input.organizationId, input.userId),
    input.status,
    "EX",
    PRESENCE_TTL_SECONDS
  );

  const recipients = await organizationRecipientIdsResolve(context, input.organizationId);
  await context.updates.publishToUsers(recipients, "user.presence", {
    orgId: input.organizationId,
    userId: input.userId,
    status: input.status
  });

  return input.status;
}
