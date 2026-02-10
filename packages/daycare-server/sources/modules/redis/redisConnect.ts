import type Redis from "ioredis";

export async function redisConnect(redis: Redis): Promise<void> {
  await redis.connect();
  await redis.ping();
}
