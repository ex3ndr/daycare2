import type { ApiContext } from "@/apps/api/lib/apiContext.js";

type PresenceGetInput = {
  organizationId: string;
  userIds: string[];
};

export type PresenceGetResult = Array<{
  userId: string;
  status: "online" | "away" | "offline";
}>;

function presenceKeyCreate(organizationId: string, userId: string): string {
  return `presence:${organizationId}:${userId}`;
}

function presenceStatusNormalize(value: string | null): "online" | "away" | "offline" {
  if (value === "online" || value === "away") {
    return value;
  }

  return "offline";
}

export async function presenceGet(
  context: ApiContext,
  input: PresenceGetInput
): Promise<PresenceGetResult> {
  if (input.userIds.length === 0) {
    return [];
  }

  const keys = input.userIds.map((userId) => presenceKeyCreate(input.organizationId, userId));
  const values = await context.redis.mget(...keys);

  return input.userIds.map((userId, index) => ({
    userId,
    status: presenceStatusNormalize(values[index] ?? null)
  }));
}
