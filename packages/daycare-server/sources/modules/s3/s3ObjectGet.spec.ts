import { describe, expect, it } from "vitest";
import { s3ClientCreate } from "./s3ClientCreate.js";
import { s3ObjectGet } from "./s3ObjectGet.js";

describe("s3ObjectGet", () => {
  it("generates a presigned URL", async () => {
    const endpoint = process.env.S3_ENDPOINT ?? "http://s3:9000";
    const accessKey = process.env.S3_ACCESS_KEY ?? "minioadmin";
    const secretKey = process.env.S3_SECRET_KEY ?? "minioadmin";
    const bucket = process.env.S3_BUCKET ?? "daycare";

    const client = s3ClientCreate({
      endpoint,
      accessKey,
      secretKey,
      forcePathStyle: true
    });

    const url = await s3ObjectGet({
      client,
      bucket,
      key: "org-1/file-1.txt",
      expiresInSeconds: 123
    });

    expect(url).toContain("X-Amz-Signature");
    expect(url).toContain("org-1/file-1.txt");
  });
});
