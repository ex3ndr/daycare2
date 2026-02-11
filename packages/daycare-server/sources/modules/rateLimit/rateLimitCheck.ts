export type RateLimitCheckInput = {
  scope: string;
  key: string;
  limit: number;
  windowSeconds: number;
  nowMs?: number;
};

export type RateLimitCheckResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

type RateLimitRedis = {
  zremrangebyscore: (key: string, min: number, max: number) => Promise<unknown>;
  zcard: (key: string) => Promise<number>;
  zrange: (key: string, start: number, stop: number, withScores: "WITHSCORES") => Promise<string[]>;
  zadd: (key: string, score: number, member: string) => Promise<unknown>;
  pexpire: (key: string, ttlMs: number) => Promise<unknown>;
};

function retryAfterCalculate(nowMs: number, oldestScore: number, windowMs: number): number {
  const remainingMs = windowMs - (nowMs - oldestScore);
  if (remainingMs <= 0) {
    return 1;
  }

  return Math.ceil(remainingMs / 1000);
}

export async function rateLimitCheck(
  redis: RateLimitRedis,
  input: RateLimitCheckInput
): Promise<RateLimitCheckResult> {
  const nowMs = input.nowMs ?? Date.now();
  const windowMs = input.windowSeconds * 1000;
  const bucketKey = `ratelimit:${input.scope}:${input.key}`;
  const windowStartMs = nowMs - windowMs;

  await redis.zremrangebyscore(bucketKey, 0, windowStartMs);

  const count = await redis.zcard(bucketKey);
  if (count >= input.limit) {
    const oldest = await redis.zrange(bucketKey, 0, 0, "WITHSCORES");
    const oldestScoreRaw = oldest[1];
    const oldestScore = oldestScoreRaw ? Number(oldestScoreRaw) : nowMs;
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: retryAfterCalculate(nowMs, oldestScore, windowMs)
    };
  }

  const member = `${nowMs}:${Math.random().toString(36).slice(2, 10)}`;
  await redis.zadd(bucketKey, nowMs, member);
  await redis.pexpire(bucketKey, windowMs);

  return {
    allowed: true,
    remaining: Math.max(input.limit - count - 1, 0),
    retryAfterSeconds: 0
  };
}
