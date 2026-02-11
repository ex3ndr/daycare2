import { createHash } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import type Redis from "ioredis";
import { ApiError } from "@/apps/api/lib/apiError.js";
import { authEmailOtpVerify } from "./authEmailOtpVerify.js";
import { authOtpCodeHash } from "./authOtpCodeHash.js";
import { databaseConnect } from "@/modules/database/databaseConnect.js";
import { databaseCreate } from "@/modules/database/databaseCreate.js";
import { redisConnect } from "@/modules/redis/redisConnect.js";
import { redisCreate } from "@/modules/redis/redisCreate.js";
import { tokenServiceCreate } from "@/modules/auth/tokenServiceCreate.js";
import { testDatabaseReset } from "@/utils/testDatabaseReset.js";

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const redisUrl = process.env.TEST_REDIS_URL ?? process.env.REDIS_URL;

if (!databaseUrl || !redisUrl) {
  throw new Error("authEmailOtpVerify.spec.ts requires DATABASE_URL and REDIS_URL (or TEST_DATABASE_URL/TEST_REDIS_URL)");
}

describe("authEmailOtpVerify", () => {
  let db: PrismaClient;
  let redis: Redis;
  let tokens: Awaited<ReturnType<typeof tokenServiceCreate>>;

  beforeAll(async () => {
    db = databaseCreate(databaseUrl);
    await databaseConnect(db);

    redis = redisCreate(redisUrl);
    await redisConnect(redis);

    tokens = await tokenServiceCreate("daycare-test", "daycare-test-seed-00000000000000000000000000000000");
  });

  beforeEach(async () => {
    await testDatabaseReset(db);
    await redis.flushall();
  });

  afterAll(async () => {
    await redis.quit();
    await db.$disconnect();
  });

  it("verifies OTP and logs in", async () => {
    const email = "user@example.com";
    const code = "123456";
    const keySuffix = createHash("sha256").update(email).digest("hex");
    const otpKey = `otp:${keySuffix}`;
    await redis.set(otpKey, authOtpCodeHash(code, "salt"));

    const context = {
      db,
      redis,
      tokens,
      otp: {
        ttlSeconds: 600,
        cooldownSeconds: 60,
        maxAttempts: 5,
        salt: "salt",
        testStatic: {
          enabled: false,
          email: "integration-test@daycare.local",
          code: "424242"
        }
      }
    } as any;

    const result = await authEmailOtpVerify(context, { email, code });

    expect(result.token).toBeTruthy();
    const account = await db.account.findUnique({ where: { email } });
    expect(account?.email).toBe(email);
  });

  it("rejects invalid OTP", async () => {
    const email = "user@example.com";
    const keySuffix = createHash("sha256").update(email).digest("hex");
    const otpKey = `otp:${keySuffix}`;
    await redis.set(otpKey, authOtpCodeHash("000000", "salt"));

    const context = {
      db,
      redis,
      tokens,
      otp: {
        ttlSeconds: 600,
        cooldownSeconds: 60,
        maxAttempts: 5,
        salt: "salt",
        testStatic: {
          enabled: false,
          email: "integration-test@daycare.local",
          code: "424242"
        }
      }
    } as any;

    await expect(authEmailOtpVerify(context, { email, code: "123456" }))
      .rejects
      .toBeInstanceOf(ApiError);
  });

  it("blocks attempts after max retries", async () => {
    const email = "user@example.com";
    const keySuffix = createHash("sha256").update(email).digest("hex");
    const otpKey = `otp:${keySuffix}`;
    const attemptsKey = `otp:${keySuffix}:attempts`;
    await redis.set(otpKey, authOtpCodeHash("123456", "salt"));
    await redis.set(attemptsKey, "5");

    const context = {
      db,
      redis,
      tokens,
      otp: {
        ttlSeconds: 600,
        cooldownSeconds: 60,
        maxAttempts: 5,
        salt: "salt",
        testStatic: {
          enabled: false,
          email: "integration-test@daycare.local",
          code: "424242"
        }
      }
    } as any;

    await expect(authEmailOtpVerify(context, { email, code: "123456" }))
      .rejects
      .toBeInstanceOf(ApiError);
  });

  it("verifies using static integration OTP when enabled and matched", async () => {
    const email = "integration-test@daycare.local";

    const context = {
      db,
      redis,
      tokens,
      otp: {
        ttlSeconds: 600,
        cooldownSeconds: 60,
        maxAttempts: 5,
        salt: "salt",
        testStatic: {
          enabled: true,
          email,
          code: "424242"
        }
      }
    } as any;

    const result = await authEmailOtpVerify(context, { email, code: "424242" });
    expect(result.token).toBeTruthy();
  });

  it("does not bypass OTP for other emails when static integration OTP is enabled", async () => {
    const context = {
      db,
      redis,
      tokens,
      otp: {
        ttlSeconds: 600,
        cooldownSeconds: 60,
        maxAttempts: 5,
        salt: "salt",
        testStatic: {
          enabled: true,
          email: "integration-test@daycare.local",
          code: "424242"
        }
      }
    } as any;

    await expect(authEmailOtpVerify(context, { email: "user@example.com", code: "424242" }))
      .rejects
      .toBeInstanceOf(ApiError);
  });

  it("does not bypass OTP for static email with wrong code", async () => {
    const context = {
      db,
      redis,
      tokens,
      otp: {
        ttlSeconds: 600,
        cooldownSeconds: 60,
        maxAttempts: 5,
        salt: "salt",
        testStatic: {
          enabled: true,
          email: "integration-test@daycare.local",
          code: "424242"
        }
      }
    } as any;

    await expect(authEmailOtpVerify(context, { email: "integration-test@daycare.local", code: "000000" }))
      .rejects
      .toBeInstanceOf(ApiError);
  });
});
