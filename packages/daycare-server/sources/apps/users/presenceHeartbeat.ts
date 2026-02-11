import type { ApiContext } from "@/apps/api/lib/apiContext.js";

const PRESENCE_TTL_SECONDS = 90;

type PresenceHeartbeatInput = {
  organizationId: string;
  userId: string;
};

function presenceKeyCreate(organizationId: string, userId: string): string {
  return `presence:${organizationId}:${userId}`;
}

export async function presenceHeartbeat(
  context: ApiContext,
  input: PresenceHeartbeatInput
): Promise<"online" | "away" | "offline"> {
  const key = presenceKeyCreate(input.organizationId, input.userId);
  const currentValue = await context.redis.get(key);

  if (currentValue === "online" || currentValue === "away") {
    await context.redis.set(key, currentValue, "EX", PRESENCE_TTL_SECONDS);
  }

  await context.db.user.updateMany({
    where: {
      id: input.userId,
      organizationId: input.organizationId
    },
    data: {
      lastSeenAt: new Date()
    }
  });

  if (currentValue === "online" || currentValue === "away") {
    return currentValue;
  }

  return "offline";
}
