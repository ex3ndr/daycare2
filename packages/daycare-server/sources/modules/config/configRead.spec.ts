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
      TOKEN_SEED: "daycare-local-token-seed-0001"
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
      otpSalt: "daycare-local-token-seed-0001"
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
      ALLOW_OPEN_ORG_JOIN: "false"
    });

    expect(config.allowOpenOrgJoin).toBe(false);
  });
});
