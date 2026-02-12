import type Redis from "ioredis";
import type { EphemeralEnvelope } from "./updatesServiceCreate.js";
import { updatesEphemeralChannelCreate } from "./updatesEphemeralChannelCreate.js";

export async function updatesEphemeralBroadcast(
  redis: Pick<Redis, "publish">,
  userId: string,
  envelope: EphemeralEnvelope
): Promise<void> {
  const channel = updatesEphemeralChannelCreate(userId);
  await redis.publish(channel, JSON.stringify(envelope));
}
