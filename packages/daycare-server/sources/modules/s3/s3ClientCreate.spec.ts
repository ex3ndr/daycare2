import { describe, expect, it } from "vitest";
import { s3ClientCreate } from "./s3ClientCreate.js";

describe("s3ClientCreate", () => {
  it("creates an S3 client with configured endpoint and credentials", () => {
    const client = s3ClientCreate({
      endpoint: "http://localhost:9000",
      accessKey: "minioadmin",
      secretKey: "minioadmin",
      forcePathStyle: true
    });

    const config = client.config;
    expect(config.endpoint).toBeDefined();
    expect(config.forcePathStyle).toBe(true);
    expect(config.region).toBeDefined();
  });
});
