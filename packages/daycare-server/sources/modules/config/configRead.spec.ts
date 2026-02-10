import { describe, expect, it } from "vitest";
import { configRead } from "./configRead.js";

describe("configRead", () => {
  it("parses required env and numeric port", () => {
    const config = configRead({
      NODE_ENV: "development",
      HOST: "127.0.0.1",
      PORT: "4001",
      DATABASE_URL: "postgresql://daycare:daycare@localhost:5432/daycare?schema=public",
      REDIS_URL: "redis://localhost:6379"
    });

    expect(config).toEqual({
      nodeEnv: "development",
      host: "127.0.0.1",
      port: 4001,
      databaseUrl: "postgresql://daycare:daycare@localhost:5432/daycare?schema=public",
      redisUrl: "redis://localhost:6379"
    });
  });
});
