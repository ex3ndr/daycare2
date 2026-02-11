import { beforeEach, describe, expect, it, vi } from "vitest";
import type Redis from "ioredis";

const redisCreateMock = vi.fn();
const redisConnectMock = vi.fn();

vi.mock("./redisCreate.js", () => ({
  redisCreate: redisCreateMock
}));

vi.mock("./redisConnect.js", () => ({
  redisConnect: redisConnectMock
}));

type RedisLike = Pick<Redis, "unsubscribe" | "quit">;

function redisMockCreate(): RedisLike {
  return {
    unsubscribe: vi.fn().mockResolvedValue(0),
    quit: vi.fn().mockResolvedValue("OK")
  };
}

describe("redisPubSubCreate", () => {
  beforeEach(() => {
    redisCreateMock.mockReset();
    redisConnectMock.mockReset();
  });

  it("creates dedicated pub/sub clients and connects both", async () => {
    const pub = redisMockCreate();
    const sub = redisMockCreate();
    redisCreateMock.mockReturnValueOnce(pub).mockReturnValueOnce(sub);

    const { redisPubSubCreate } = await import("./redisPubSubCreate.js");
    const pubSub = redisPubSubCreate("redis://localhost:6379");
    await pubSub.connect();

    expect(redisCreateMock).toHaveBeenCalledTimes(2);
    expect(redisConnectMock).toHaveBeenCalledWith(pub);
    expect(redisConnectMock).toHaveBeenCalledWith(sub);
  });

  it("disconnects gracefully even when one call fails", async () => {
    const pub = redisMockCreate();
    const sub = redisMockCreate();
    const subQuit = vi.fn().mockRejectedValue(new Error("boom"));
    sub.quit = subQuit;
    redisCreateMock.mockReturnValueOnce(pub).mockReturnValueOnce(sub);

    const { redisPubSubCreate } = await import("./redisPubSubCreate.js");
    const pubSub = redisPubSubCreate("redis://localhost:6379");

    await expect(pubSub.disconnect()).resolves.toBeUndefined();
    expect(sub.unsubscribe).toHaveBeenCalledTimes(1);
    expect(subQuit).toHaveBeenCalledTimes(1);
    expect(pub.quit).toHaveBeenCalledTimes(1);
  });
});
