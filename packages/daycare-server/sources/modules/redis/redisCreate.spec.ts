import { describe, expect, it } from "vitest";
import { redisConnect } from "./redisConnect.js";
import { redisCreate } from "./redisCreate.js";

describe("redisCreate", () => {
  it("creates redis client with expected defaults and can connect", async () => {
    const redisUrl = process.env.TEST_REDIS_URL ?? process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error("redisCreate.spec.ts requires REDIS_URL or TEST_REDIS_URL");
    }

    const client = redisCreate(redisUrl);
    await redisConnect(client);

    const pong = await client.ping();
    expect(pong).toBe("PONG");

    await client.quit();
  });
});
