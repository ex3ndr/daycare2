import { afterEach, describe, expect, it } from "vitest";
import { redisPubSubCreate, type RedisPubSub } from "./redisPubSubCreate.js";

const createdPubSubs: RedisPubSub[] = [];

afterEach(async () => {
  await Promise.all(createdPubSubs.splice(0).map(async (pubSub) => {
    await pubSub.disconnect();
  }));
});

describe("redisPubSubCreate", () => {
  it("creates dedicated pub/sub clients and delivers published messages", async () => {
    const redisUrl = process.env.TEST_REDIS_URL ?? process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error("redisPubSubCreate.spec.ts requires REDIS_URL or TEST_REDIS_URL");
    }

    const pubSub = redisPubSubCreate(redisUrl);
    createdPubSubs.push(pubSub);

    await pubSub.connect();

    const channel = `updates:${Date.now()}`;
    const payload = JSON.stringify({ ok: true });

    const received = new Promise<{ channel: string; message: string }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timed out waiting for redis pub/sub message"));
      }, 2_000);

      pubSub.sub.on("message", (incomingChannel, message) => {
        clearTimeout(timeout);
        resolve({ channel: incomingChannel, message });
      });
    });

    await pubSub.sub.subscribe(channel);
    await pubSub.pub.publish(channel, payload);

    await expect(received).resolves.toEqual({ channel, message: payload });
  });

  it("disconnects gracefully", async () => {
    const redisUrl = process.env.TEST_REDIS_URL ?? process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error("redisPubSubCreate.spec.ts requires REDIS_URL or TEST_REDIS_URL");
    }

    const pubSub = redisPubSubCreate(redisUrl);
    await pubSub.connect();

    await expect(pubSub.disconnect()).resolves.toBeUndefined();
  });
});
