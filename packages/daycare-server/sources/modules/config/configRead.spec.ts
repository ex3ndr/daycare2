import { describe, expect, it } from "vitest";
import { configRead } from "./configRead.js";

describe("configRead", () => {
  it("parses required env and numeric port", () => {
    const config = configRead({
      NODE_ENV: "development",
      HOST: "127.0.0.1",
      PORT: "4001",
      DATABASE_URL: "postgresql://daycare:daycare@localhost:5432/daycare?schema=public",
      REDIS_URL: "redis://localhost:6379",
      TOKEN_SEED: "daycare-local-token-seed-0001",
      S3_ACCESS_KEY: "minioadmin",
      S3_SECRET_KEY: "minioadmin"
    });

    expect(config).toEqual({
      nodeEnv: "development",
      host: "127.0.0.1",
      port: 4001,
      databaseUrl: "postgresql://daycare:daycare@localhost:5432/daycare?schema=public",
      redisUrl: "redis://localhost:6379",
      tokenService: "daycare",
      tokenSeed: "daycare-local-token-seed-0001",
      allowOpenOrgJoin: true,
      resendApiKey: undefined,
      resendFrom: undefined,
      otpTtlSeconds: 600,
      otpCooldownSeconds: 60,
      otpMaxAttempts: 5,
      otpSalt: "daycare-local-token-seed-0001",
      otpStaticEnabled: false,
      otpStaticEmail: "integration-test@daycare.local",
      otpStaticCode: "424242",
      s3Endpoint: "http://localhost:9000",
      s3AccessKey: "minioadmin",
      s3SecretKey: "minioadmin",
      s3Bucket: "daycare",
      s3ForcePathStyle: true
    });
  });

  it("respects explicit ALLOW_OPEN_ORG_JOIN=false", () => {
    const config = configRead({
      NODE_ENV: "production",
      HOST: "127.0.0.1",
      PORT: "4001",
      DATABASE_URL: "postgresql://daycare:daycare@localhost:5432/daycare?schema=public",
      REDIS_URL: "redis://localhost:6379",
      TOKEN_SEED: "daycare-local-token-seed-0001",
      S3_ACCESS_KEY: "minioadmin",
      S3_SECRET_KEY: "minioadmin",
      ALLOW_OPEN_ORG_JOIN: "false"
    });

    expect(config.allowOpenOrgJoin).toBe(false);
  });

  it("parses static OTP config", () => {
    const config = configRead({
      NODE_ENV: "production",
      HOST: "127.0.0.1",
      PORT: "4001",
      DATABASE_URL: "postgresql://daycare:daycare@localhost:5432/daycare?schema=public",
      REDIS_URL: "redis://localhost:6379",
      TOKEN_SEED: "daycare-local-token-seed-0001",
      S3_ACCESS_KEY: "minioadmin",
      S3_SECRET_KEY: "minioadmin",
      OTP_STATIC_ENABLED: "true",
      OTP_STATIC_EMAIL: "INTEGRATION-TEST@DAYCARE.LOCAL",
      OTP_STATIC_CODE: "135790"
    });

    expect(config.otpStaticEnabled).toBe(true);
    expect(config.otpStaticEmail).toBe("integration-test@daycare.local");
    expect(config.otpStaticCode).toBe("135790");
  });
});
