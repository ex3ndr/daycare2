import { afterEach, describe, expect, it, vi } from "vitest";
import { rateLimitCheck } from "./rateLimitCheck.js";

type RateLimitEntry = {
  member: string;
  score: number;
};

type RateLimitRedisMock = {
  zremrangebyscore: (key: string, min: number, max: number) => Promise<number>;
  zcard: (key: string) => Promise<number>;
  zrange: (key: string, start: number, stop: number, withScores: "WITHSCORES") => Promise<string[]>;
  zadd: (key: string, score: number, member: string) => Promise<number>;
  pexpire: (key: string, ttlMs: number) => Promise<number>;
  seed: (key: string, entries: RateLimitEntry[]) => void;
};

function redisMockCreate(): RateLimitRedisMock {
  const store = new Map<string, RateLimitEntry[]>();

  return {
    zremrangebyscore: async (key: string, min: number, max: number) => {
      const existing = store.get(key) ?? [];
      const filtered = existing.filter((entry) => entry.score < min || entry.score > max);
      store.set(key, filtered);
      return existing.length - filtered.length;
    },
    zcard: async (key: string) => {
      return (store.get(key) ?? []).length;
    },
    zrange: async (key: string, start: number, _stop: number, withScores: "WITHSCORES") => {
      const entries = (store.get(key) ?? []).slice().sort((left, right) => left.score - right.score);
      const item = entries[start];
      if (!item || withScores !== "WITHSCORES") {
        return [];
      }
      return [item.member, String(item.score)];
    },
    zadd: async (key: string, score: number, member: string) => {
      const entries = store.get(key) ?? [];
      entries.push({ member, score });
      store.set(key, entries);
      return 1;
    },
    pexpire: async (_key: string, _ttlMs: number) => {
      return 1;
    },
    seed: (key: string, entries: RateLimitEntry[]) => {
      store.set(key, entries.slice());
    }
  };
}

describe("rateLimitCheck", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests under the limit", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-11T00:00:00.000Z"));
    const redis = redisMockCreate();

    const result = await rateLimitCheck(redis, {
      scope: "messages.send",
      key: "user-1",
      limit: 3,
      windowSeconds: 60
    });

    expect(result).toEqual({
      allowed: true,
      remaining: 2,
      retryAfterSeconds: 0
    });
  });

  it("rejects requests when count is at limit", async () => {
    vi.useFakeTimers();
    const now = new Date("2026-02-11T00:00:00.000Z");
    vi.setSystemTime(now);
    const redis = redisMockCreate();
    const bucket = "ratelimit:messages.send:user-1";
    redis.seed(bucket, [
      { member: "a", score: now.getTime() - 30_000 },
      { member: "b", score: now.getTime() - 20_000 },
      { member: "c", score: now.getTime() - 10_000 }
    ]);

    const result = await rateLimitCheck(redis, {
      scope: "messages.send",
      key: "user-1",
      limit: 3,
      windowSeconds: 60
    });

    expect(result).toEqual({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 30
    });
  });

  it("rejects requests when count is above limit", async () => {
    vi.useFakeTimers();
    const now = new Date("2026-02-11T00:00:00.000Z");
    vi.setSystemTime(now);
    const redis = redisMockCreate();
    const bucket = "ratelimit:typing:user-1:chat-1";
    redis.seed(bucket, [
      { member: "a", score: now.getTime() - 40_000 },
      { member: "b", score: now.getTime() - 30_000 },
      { member: "c", score: now.getTime() - 20_000 },
      { member: "d", score: now.getTime() - 10_000 }
    ]);

    const result = await rateLimitCheck(redis, {
      scope: "typing",
      key: "user-1:chat-1",
      limit: 3,
      windowSeconds: 60
    });

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterSeconds).toBe(20);
  });

  it("expires old entries after the window and allows request", async () => {
    vi.useFakeTimers();
    const now = new Date("2026-02-11T00:00:00.000Z");
    vi.setSystemTime(now);
    const redis = redisMockCreate();
    const bucket = "ratelimit:search:user-1";
    redis.seed(bucket, [
      { member: "old", score: now.getTime() - 90_000 }
    ]);

    const result = await rateLimitCheck(redis, {
      scope: "search",
      key: "user-1",
      limit: 1,
      windowSeconds: 60
    });

    expect(result).toEqual({
      allowed: true,
      remaining: 0,
      retryAfterSeconds: 0
    });
  });
});
