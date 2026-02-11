import { describe, expect, it, vi } from "vitest";
import { s3ObjectPut } from "./s3ObjectPut.js";

describe("s3ObjectPut", () => {
  it("uploads an object to S3", async () => {
    const send = vi.fn().mockResolvedValue({});
    const client = { send } as any;

    await s3ObjectPut({
      client,
      bucket: "daycare",
      key: "org-1/file-1.txt",
      contentType: "text/plain",
      payload: Buffer.from("hello")
    });

    expect(send).toHaveBeenCalledTimes(1);
    const [command] = send.mock.calls[0] ?? [];
    expect(command.input).toMatchObject({
      Bucket: "daycare",
      Key: "org-1/file-1.txt",
      ContentType: "text/plain"
    });
  });
});
