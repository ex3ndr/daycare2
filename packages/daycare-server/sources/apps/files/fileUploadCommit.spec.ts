import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";

vi.mock("@/modules/s3/s3ObjectPut.js", () => ({
  s3ObjectPut: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("@/modules/s3/s3ObjectDelete.js", () => ({
  s3ObjectDelete: vi.fn().mockResolvedValue(undefined)
}));

import { s3ObjectDelete } from "@/modules/s3/s3ObjectDelete.js";
import { s3ObjectPut } from "@/modules/s3/s3ObjectPut.js";
import { fileUploadCommit } from "./fileUploadCommit.js";

type TransactionRunner<DB extends object> = {
  $transaction: <T>(fn: (tx: DB) => Promise<T>) => Promise<T>;
};

function dbWithTransaction<DB extends object>(db: DB): DB & TransactionRunner<DB> {
  return {
    ...db,
    $transaction: async <T>(fn: (tx: DB) => Promise<T>) => fn(db)
  };
}

describe("fileUploadCommit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uploads payload to S3 and commits file asset", async () => {
    const payload = Buffer.from("hello");
    const contentHash = createHash("sha256").update(payload).digest("hex");
    const pendingFile = {
      id: "file-1",
      organizationId: "org-1",
      createdByUserId: "user-1",
      storageKey: "org-1/user-1/file-1/hello.txt",
      contentHash,
      mimeType: "text/plain",
      sizeBytes: payload.length,
      status: "PENDING"
    };
    const committedFile = {
      ...pendingFile,
      status: "COMMITTED",
      createdAt: new Date("2026-02-11T00:00:00.000Z"),
      updatedAt: new Date("2026-02-11T00:00:01.000Z"),
      expiresAt: null,
      committedAt: new Date("2026-02-11T00:00:01.000Z")
    };

    const context = {
      db: dbWithTransaction({
        fileAsset: {
          findFirst: vi.fn().mockResolvedValue(pendingFile),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findUnique: vi.fn().mockResolvedValue(committedFile)
        }
      }),
      updates: {
        publishToUsers: vi.fn().mockResolvedValue(undefined)
      },
      s3: { send: vi.fn() } as any,
      s3Bucket: "daycare"
    } as unknown as ApiContext;

    const result = await fileUploadCommit(context, {
      organizationId: "org-1",
      userId: "user-1",
      fileId: "file-1",
      payloadBase64: payload.toString("base64")
    });

    expect(s3ObjectPut).toHaveBeenCalledWith({
      client: context.s3,
      bucket: "daycare",
      key: "org-1/user-1/file-1/hello.txt",
      contentType: "text/plain",
      payload
    });
    expect(context.db.fileAsset.updateMany).toHaveBeenCalled();
    expect(context.updates.publishToUsers).toHaveBeenCalledWith(["user-1"], "file.committed", {
      orgId: "org-1",
      fileId: "file-1"
    });
    expect(result.status).toBe("COMMITTED");
  });

  it("fails when S3 upload fails", async () => {
    const payload = Buffer.from("hello");
    const contentHash = createHash("sha256").update(payload).digest("hex");
    vi.mocked(s3ObjectPut).mockRejectedValueOnce(new Error("s3 unavailable"));

    const context = {
      db: dbWithTransaction({
        fileAsset: {
          findFirst: vi.fn().mockResolvedValue({
            id: "file-1",
            organizationId: "org-1",
            createdByUserId: "user-1",
            storageKey: "org-1/user-1/file-1/hello.txt",
            contentHash,
            mimeType: "text/plain",
            sizeBytes: payload.length,
            status: "PENDING"
          }),
          updateMany: vi.fn()
        }
      }),
      s3: { send: vi.fn() } as any,
      s3Bucket: "daycare"
    } as unknown as ApiContext;

    await expect(fileUploadCommit(context, {
      organizationId: "org-1",
      userId: "user-1",
      fileId: "file-1",
      payloadBase64: payload.toString("base64")
    })).rejects.toThrow("s3 unavailable");

    expect(context.db.fileAsset.updateMany).not.toHaveBeenCalled();
    expect(s3ObjectDelete).not.toHaveBeenCalled();
  });

  it("rolls back uploaded object when DB commit fails", async () => {
    const payload = Buffer.from("hello");
    const contentHash = createHash("sha256").update(payload).digest("hex");

    const context = {
      db: dbWithTransaction({
        fileAsset: {
          findFirst: vi.fn().mockResolvedValue({
            id: "file-1",
            organizationId: "org-1",
            createdByUserId: "user-1",
            storageKey: "org-1/user-1/file-1/hello.txt",
            contentHash,
            mimeType: "text/plain",
            sizeBytes: payload.length,
            status: "PENDING"
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 0 })
        }
      }),
      s3: { send: vi.fn() } as any,
      s3Bucket: "daycare"
    } as unknown as ApiContext;

    await expect(fileUploadCommit(context, {
      organizationId: "org-1",
      userId: "user-1",
      fileId: "file-1",
      payloadBase64: payload.toString("base64")
    })).rejects.toMatchObject({
      statusCode: 404
    });

    expect(s3ObjectPut).toHaveBeenCalled();
    expect(s3ObjectDelete).toHaveBeenCalledWith({
      client: context.s3,
      bucket: "daycare",
      key: "org-1/user-1/file-1/hello.txt"
    });
  });
});
