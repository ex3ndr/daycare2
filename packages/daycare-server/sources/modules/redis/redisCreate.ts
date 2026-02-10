import Redis from "ioredis";

export function redisCreate(redisUrl: string): Redis {
  return new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 2
  });
}
