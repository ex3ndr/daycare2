import { describe, expect, it, vi } from "vitest";

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn().mockResolvedValue("https://example.com/signed")
}));

import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3ObjectGet } from "./s3ObjectGet.js";

describe("s3ObjectGet", () => {
  it("generates a presigned URL", async () => {
    const client = {} as any;

    const url = await s3ObjectGet({
      client,
      bucket: "daycare",
      key: "org-1/file-1.txt",
      expiresInSeconds: 123
    });

    expect(url).toBe("https://example.com/signed");
    expect(getSignedUrl).toHaveBeenCalledTimes(1);
    const [calledClient, command, options] = vi.mocked(getSignedUrl).mock.calls[0] ?? [];
    if (!command) {
      throw new Error("Expected command argument");
    }
    expect(calledClient).toBe(client);
    expect(command.input).toMatchObject({
      Bucket: "daycare",
      Key: "org-1/file-1.txt"
    });
    expect(options).toEqual({ expiresIn: 123 });
  });
});
