import type { PrismaClient } from "@prisma/client";
import type Redis from "ioredis";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { tokenServiceCreate } from "@/modules/auth/tokenServiceCreate.js";
import { databaseConnect } from "@/modules/database/databaseConnect.js";
import { databaseCreate } from "@/modules/database/databaseCreate.js";
import { emailServiceCreate } from "@/modules/email/emailServiceCreate.js";
import { redisConnect } from "@/modules/redis/redisConnect.js";
import { redisCreate } from "@/modules/redis/redisCreate.js";
import { s3ClientCreate } from "@/modules/s3/s3ClientCreate.js";
import { updatesServiceCreate } from "@/modules/updates/updatesServiceCreate.js";
import { testDatabaseReset } from "@/utils/testDatabaseReset.js";

export async function testLiveContextCreate(): Promise<{
  context: ApiContext;
  db: PrismaClient;
  redis: Redis;
  reset: () => Promise<void>;
  close: () => Promise<void>;
}> {
  const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  const redisUrl = process.env.TEST_REDIS_URL ?? process.env.REDIS_URL;

  if (!databaseUrl || !redisUrl) {
    throw new Error("testLiveContextCreate requires DATABASE_URL and REDIS_URL (or TEST_DATABASE_URL/TEST_REDIS_URL)");
  }

  const db = databaseCreate(databaseUrl);
  await databaseConnect(db);

  const redis = redisCreate(redisUrl);
  await redisConnect(redis);

  const tokenSeed = process.env.TOKEN_SEED ?? "daycare-test-seed-00000000000000000000000000000000";
  const tokenService = process.env.TOKEN_SERVICE ?? "daycare-test";
  const s3Endpoint = process.env.S3_ENDPOINT ?? "http://s3:9000";
  const s3AccessKey = process.env.S3_ACCESS_KEY ?? "minioadmin";
  const s3SecretKey = process.env.S3_SECRET_KEY ?? "minioadmin";
  const s3Bucket = process.env.S3_BUCKET ?? "daycare";
  const s3ForcePathStyle = process.env.S3_FORCE_PATH_STYLE === undefined
    ? true
    : process.env.S3_FORCE_PATH_STYLE === "true";
  const tokens = await tokenServiceCreate(tokenService, tokenSeed);
  const email = emailServiceCreate({ nodeEnv: "test" });
  const s3 = s3ClientCreate({
    endpoint: s3Endpoint,
    accessKey: s3AccessKey,
    secretKey: s3SecretKey,
    forcePathStyle: s3ForcePathStyle
  });
  const updates = updatesServiceCreate(db);

  const context: ApiContext = {
    db,
    redis,
    tokens,
    email,
    updates,
    s3,
    s3Bucket,
    nodeEnv: "test",
    allowOpenOrgJoin: true,
    otp: {
      ttlSeconds: 600,
      cooldownSeconds: 60,
      maxAttempts: 5,
      salt: tokenSeed,
      testStatic: {
        enabled: false,
        email: "integration-test@daycare.local",
        code: "424242"
      }
    }
  };

  const reset = async (): Promise<void> => {
    await testDatabaseReset(db);
    await redis.flushall();
  };

  const close = async (): Promise<void> => {
    await updates.stop();
    await redis.quit();
    await db.$disconnect();
  };

  return {
    context,
    db,
    redis,
    reset,
    close
  };
}
