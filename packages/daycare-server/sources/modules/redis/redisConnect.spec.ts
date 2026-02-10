import type Redis from "ioredis";
import { describe, expect, it, vi } from "vitest";
import { redisConnect } from "./redisConnect.js";

describe("redisConnect", () => {
  it("connects and verifies redis via ping", async () => {
    const connect = vi.fn().mockResolvedValue(undefined);
    const ping = vi.fn().mockResolvedValue("PONG");
    const redis = {
      connect,
      ping
    } as unknown as Redis;

    await redisConnect(redis);

    expect(connect).toHaveBeenCalledTimes(1);
    expect(ping).toHaveBeenCalledTimes(1);
  });
});
