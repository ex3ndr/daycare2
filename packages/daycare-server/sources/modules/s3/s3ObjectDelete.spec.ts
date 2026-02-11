import { describe, expect, it, vi } from "vitest";
import { s3ObjectDelete } from "./s3ObjectDelete.js";

describe("s3ObjectDelete", () => {
  it("deletes an object from S3", async () => {
    const send = vi.fn().mockResolvedValue({});
    const client = { send } as any;

    await s3ObjectDelete({
      client,
      bucket: "daycare",
      key: "org-1/file-1.txt"
    });

    expect(send).toHaveBeenCalledTimes(1);
    const [command] = send.mock.calls[0] ?? [];
    expect(command.input).toMatchObject({
      Bucket: "daycare",
      Key: "org-1/file-1.txt"
    });
  });
});
