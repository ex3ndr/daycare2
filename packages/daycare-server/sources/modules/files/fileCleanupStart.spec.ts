import { createHash } from "node:crypto";
import { createId } from "@paralleldrive/cuid2";
import { CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { s3ObjectPut } from "@/modules/s3/s3ObjectPut.js";
import { testLiveContextCreate } from "@/utils/testLiveContextCreate.js";
import { fileCleanupStart } from "./fileCleanupStart.js";

type LiveContext = Awaited<ReturnType<typeof testLiveContextCreate>>;

async function waitFor(predicate: () => Promise<boolean>, timeoutMs = 2_000): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error("Timed out waiting for condition");
}

describe("fileCleanupStart", () => {
  let live: LiveContext;

  beforeAll(async () => {
    live = await testLiveContextCreate();
  });

  beforeEach(async () => {
    await live.reset();

    try {
      await live.context.s3.send(new HeadBucketCommand({ Bucket: live.context.s3Bucket }));
    } catch {
      await live.context.s3.send(new CreateBucketCommand({ Bucket: live.context.s3Bucket }));
    }
  });

  afterAll(async () => {
    await live.close();
  });

  async function seedFileData() {
    const organizationId = createId();
    const userId = createId();

    await live.db.organization.create({
      data: {
        id: organizationId,
        slug: `org-${createId().slice(0, 8)}`,
        name: "Acme"
      }
    });

    await live.db.user.create({
      data: {
        id: userId,
        organizationId,
        kind: "HUMAN",
        firstName: "Owner",
        username: `owner-${createId().slice(0, 6)}`
      }
    });

    return { organizationId, userId };
  }

  it("removes expired pending and deleted files from S3 and database", async () => {
    const { organizationId, userId } = await seedFileData();
    const payload = Buffer.from("cleanup");
    const contentHash = createHash("sha256").update(payload).digest("hex");

    const pendingId = createId();
    const deletedId = createId();
    const pendingKey = `${organizationId}/${userId}/${pendingId}/pending.txt`;
    const deletedKey = `${organizationId}/${userId}/${deletedId}/deleted.txt`;

    await s3ObjectPut({
      client: live.context.s3,
      bucket: live.context.s3Bucket,
      key: pendingKey,
      contentType: "text/plain",
      payload
    });

    await s3ObjectPut({
      client: live.context.s3,
      bucket: live.context.s3Bucket,
      key: deletedKey,
      contentType: "text/plain",
      payload
    });

    await live.db.fileAsset.createMany({
      data: [
        {
          id: pendingId,
          organizationId,
          createdByUserId: userId,
          storageKey: pendingKey,
          contentHash,
          mimeType: "text/plain",
          sizeBytes: payload.length,
          status: "PENDING",
          expiresAt: new Date(Date.now() - 1_000)
        },
        {
          id: deletedId,
          organizationId,
          createdByUserId: userId,
          storageKey: deletedKey,
          contentHash,
          mimeType: "text/plain",
          sizeBytes: payload.length,
          status: "DELETED"
        }
      ]
    });

    const stop = fileCleanupStart(live.db, live.context.s3, live.context.s3Bucket, { intervalMs: 50 });

    try {
      await waitFor(async () => {
        const count = await live.db.fileAsset.count({
          where: {
            id: {
              in: [pendingId, deletedId]
            }
          }
        });
        return count === 0;
      });
    } finally {
      stop();
    }

    const remaining = await live.db.fileAsset.count({
      where: {
        id: {
          in: [pendingId, deletedId]
        }
      }
    });
    expect(remaining).toBe(0);
  });

  it("skips deletes when no files are eligible", async () => {
    const { organizationId, userId } = await seedFileData();
    const payload = Buffer.from("keep");
    const contentHash = createHash("sha256").update(payload).digest("hex");
    const committedId = createId();

    await live.db.fileAsset.create({
      data: {
        id: committedId,
        organizationId,
        createdByUserId: userId,
        storageKey: `${organizationId}/${userId}/${committedId}/committed.txt`,
        contentHash,
        mimeType: "text/plain",
        sizeBytes: payload.length,
        status: "COMMITTED",
        committedAt: new Date()
      }
    });

    const stop = fileCleanupStart(live.db, live.context.s3, live.context.s3Bucket, { intervalMs: 50 });

    try {
      await new Promise((resolve) => setTimeout(resolve, 200));
    } finally {
      stop();
    }

    const remaining = await live.db.fileAsset.count({
      where: {
        id: committedId
      }
    });
    expect(remaining).toBe(1);
  });
});
