import type Redis from "ioredis";
import type { UpdateEnvelope } from "./updatesServiceCreate.js";
import { updatesChannelCreate } from "./updatesChannelCreate.js";

export async function updatesBroadcast(
  redis: Pick<Redis, "publish">,
  userId: string,
  envelope: UpdateEnvelope
): Promise<void> {
  const channel = updatesChannelCreate(userId);
  await redis.publish(channel, JSON.stringify(envelope));
}
