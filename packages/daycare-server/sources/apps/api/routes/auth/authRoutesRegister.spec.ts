import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import type Redis from "ioredis";
import { createHash } from "node:crypto";
import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { createId } from "@paralleldrive/cuid2";
import { apiCreate } from "@/apps/api/apiCreate.js";
import { authOtpCodeHash } from "@/apps/auth/authOtpCodeHash.js";
import { databaseConnect } from "@/modules/database/databaseConnect.js";
import { databaseCreate } from "@/modules/database/databaseCreate.js";
import { redisConnect } from "@/modules/redis/redisConnect.js";
import { redisCreate } from "@/modules/redis/redisCreate.js";
import { tokenServiceCreate } from "@/modules/auth/tokenServiceCreate.js";
import { updatesServiceCreate } from "@/modules/updates/updatesServiceCreate.js";
import { emailServiceCreate } from "@/modules/email/emailServiceCreate.js";
import { testDatabaseReset } from "@/utils/testDatabaseReset.js";

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const redisUrl = process.env.TEST_REDIS_URL ?? process.env.REDIS_URL;

if (!databaseUrl || !redisUrl) {
  throw new Error("authRoutesRegister.spec.ts requires DATABASE_URL and REDIS_URL (or TEST_DATABASE_URL/TEST_REDIS_URL)");
}

describe("authRoutesRegister", () => {
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

  async function appCreate(nodeEnv: "development" | "test" | "production"): Promise<FastifyInstance> {
    const email = emailServiceCreate({
      nodeEnv,
      apiKey: nodeEnv === "production" ? "test-key" : undefined,
      from: nodeEnv === "production" ? "Daycare <no-reply@daycare.local>" : undefined
    });
    const updates = updatesServiceCreate(db);
    const app = await apiCreate({
      db,
      redis,
      tokens,
      email,
      updates,
      nodeEnv,
      allowOpenOrgJoin: true,
      otp: {
        ttlSeconds: 600,
        cooldownSeconds: 60,
        maxAttempts: 5,
        salt: "salt"
      }
    });
    await app.ready();
    return app;
  }

  it("logs in with direct email in development", async () => {
    const app = await appCreate("development");
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        email: "dev@example.com"
      }
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as any;
    expect(payload.ok).toBe(true);
    expect(payload.data.token).toBeTruthy();

    await app.close();
  });

  it("rejects direct email login in production", async () => {
    const app = await appCreate("production");
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        email: "dev@example.com"
      }
    });

    expect(response.statusCode).toBe(403);
    const payload = response.json() as any;
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("FORBIDDEN");

    await app.close();
  });

  it("revokes session on logout", async () => {
    const app = await appCreate("test");
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        email: "user@example.com"
      }
    });

    const loginPayload = login.json() as any;
    const token = loginPayload.data.token;

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as any;
    expect(payload.ok).toBe(true);
    expect(payload.data.revoked).toBe(true);

    await app.close();
  });

  it("returns account and organizations on /me", async () => {
    const app = await appCreate("test");
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        email: "user@example.com"
      }
    });

    const loginPayload = login.json() as any;
    const token = loginPayload.data.token;
    const accountId = loginPayload.data.account.id;

    const orgId = createId();
    await db.organization.create({
      data: {
        id: orgId,
        slug: "acme",
        name: "Acme"
      }
    });
    await db.user.create({
      data: {
        id: createId(),
        organizationId: orgId,
        accountId,
        kind: "HUMAN",
        firstName: "Owner",
        username: "owner"
      }
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/me",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as any;
    expect(payload.ok).toBe(true);
    expect(payload.data.organizations).toHaveLength(1);

    await app.close();
  });

  it("requests an OTP email", async () => {
    const app = await appCreate("test");
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/email/request-otp",
      payload: {
        email: "user@example.com"
      }
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as any;
    expect(payload.ok).toBe(true);
    expect(payload.data.sent).toBe(true);

    await app.close();
  });

  it("verifies an OTP code", async () => {
    const app = await appCreate("test");
    const email = "user@example.com";
    const otpKey = `otp:${createHash("sha256").update(email).digest("hex")}`;
    await redis.set(otpKey, authOtpCodeHash("123456", "salt"), "EX", 600);

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/email/verify-otp",
      payload: {
        email,
        code: "123456"
      }
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as any;
    expect(payload.ok).toBe(true);
    expect(payload.data.token).toBeTruthy();

    await app.close();
  });
});
