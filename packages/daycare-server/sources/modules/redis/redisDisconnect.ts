import type Redis from "ioredis";

export async function redisDisconnect(redis: Redis): Promise<void> {
  await redis.quit();
}
