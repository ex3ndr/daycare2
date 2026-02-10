import { beforeEach, describe, expect, it, vi } from "vitest";

const redisMock = vi.fn();

vi.mock("ioredis", () => ({
  default: redisMock
}));

describe("redisCreate", () => {
  beforeEach(() => {
    redisMock.mockReset();
  });

  it("creates redis client with default connection options", async () => {
    const client = { id: "redis-client" };
    redisMock.mockImplementation(() => client);

    const { redisCreate } = await import("./redisCreate.js");
    const result = redisCreate("redis://localhost:6379");

    expect(redisMock).toHaveBeenCalledWith("redis://localhost:6379", {
      lazyConnect: true,
      maxRetriesPerRequest: 2
    });
    expect(result).toBe(client);
  });
});
