import { createHash } from "node:crypto";
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import type Redis from "ioredis";
import { ApiError } from "@/apps/api/lib/apiError.js";
import { authEmailOtpRequest } from "./authEmailOtpRequest.js";
import { authOtpCodeHash } from "./authOtpCodeHash.js";
import { redisConnect } from "@/modules/redis/redisConnect.js";
import { redisCreate } from "@/modules/redis/redisCreate.js";

vi.mock("@/apps/auth/authOtpCodeCreate.js", () => ({
  authOtpCodeCreate: () => "123456"
}));

const redisUrl = process.env.TEST_REDIS_URL ?? process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error("authEmailOtpRequest.spec.ts requires REDIS_URL or TEST_REDIS_URL");
}

describe("authEmailOtpRequest", () => {
  let redis: Redis;

  beforeAll(async () => {
    redis = redisCreate(redisUrl);
    await redisConnect(redis);
  });

  beforeEach(async () => {
    await redis.flushall();
  });

  afterAll(async () => {
    await redis.quit();
  });

  it("stores OTP hash and sends email", async () => {
    const emailSend = vi.fn().mockResolvedValue(undefined);
    const context = {
      redis,
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
      },
      email: {
        send: emailSend
      }
    } as any;

    const result = await authEmailOtpRequest(context, { email: "User@Example.com" });

    expect(result.sent).toBe(true);
    const hashed = authOtpCodeHash("123456", "salt");
    const keySuffix = createHash("sha256").update("user@example.com").digest("hex");
    const stored = await redis.get(`otp:${keySuffix}`);
    expect(stored).toBe(hashed);
    expect(emailSend).toHaveBeenCalledTimes(1);
  });

  it("enforces cooldown", async () => {
    const context = {
      redis,
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
      },
      email: {
        send: vi.fn()
      }
    } as any;

    await authEmailOtpRequest(context, { email: "user@example.com" });

    await expect(authEmailOtpRequest(context, { email: "user@example.com" }))
      .rejects
      .toBeInstanceOf(ApiError);
  });

  it("cleans up Redis keys when email fails", async () => {
    const context = {
      redis,
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
      },
      email: {
        send: vi.fn().mockRejectedValue(new Error("fail"))
      }
    } as any;

    await expect(authEmailOtpRequest(context, { email: "user@example.com" }))
      .rejects
      .toBeInstanceOf(ApiError);

    const keySuffix = createHash("sha256").update("user@example.com").digest("hex");
    expect(await redis.get(`otp:${keySuffix}`)).toBeNull();
    expect(await redis.get(`otp:${keySuffix}:cooldown`)).toBeNull();
  });

  it("does not send email for static integration email when enabled", async () => {
    const emailSend = vi.fn().mockResolvedValue(undefined);
    const context = {
      redis,
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
      },
      email: {
        send: emailSend
      }
    } as any;

    const result = await authEmailOtpRequest(context, { email: "integration-test@daycare.local" });

    expect(result.sent).toBe(true);
    const hashed = authOtpCodeHash("123456", "salt");
    const keySuffix = createHash("sha256").update("integration-test@daycare.local").digest("hex");
    const stored = await redis.get(`otp:${keySuffix}`);
    expect(stored).toBe(hashed);
    expect(emailSend).not.toHaveBeenCalled();
  });
});
