import { createHash } from "node:crypto";
import { createId } from "@paralleldrive/cuid2";
import { CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testLiveContextCreate } from "@/utils/testLiveContextCreate.js";
import { fileUploadCommit } from "./fileUploadCommit.js";

type LiveContext = Awaited<ReturnType<typeof testLiveContextCreate>>;

describe("fileUploadCommit", () => {
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

  async function seedPendingFile(payload: Buffer) {
    const organizationId = createId();
    const userId = createId();
    const fileId = createId();

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

    const contentHash = createHash("sha256").update(payload).digest("hex");
    await live.db.fileAsset.create({
      data: {
        id: fileId,
        organizationId,
        createdByUserId: userId,
        storageKey: `${organizationId}/${userId}/${fileId}/hello.txt`,
        contentHash,
        mimeType: "text/plain",
        sizeBytes: payload.length,
        status: "PENDING",
        expiresAt: new Date(Date.now() + 60_000)
      }
    });

    return { organizationId, userId, fileId };
  }

  it("uploads payload to S3 and commits file asset", async () => {
    const payload = Buffer.from("hello");
    const seeded = await seedPendingFile(payload);

    const result = await fileUploadCommit(live.context, {
      organizationId: seeded.organizationId,
      userId: seeded.userId,
      fileId: seeded.fileId,
      payloadBase64: payload.toString("base64")
    });

    expect(result.status).toBe("COMMITTED");
    expect(result.committedAt).not.toBeNull();

    const updates = await live.db.userUpdate.findMany();
    expect(updates).toHaveLength(1);
    expect(updates[0]?.eventType).toBe("file.committed");
  });

  it("fails validation when payload hash does not match", async () => {
    const payload = Buffer.from("hello");
    const seeded = await seedPendingFile(payload);

    await expect(fileUploadCommit(live.context, {
      organizationId: seeded.organizationId,
      userId: seeded.userId,
      fileId: seeded.fileId,
      payloadBase64: Buffer.from("other").toString("base64")
    })).rejects.toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR"
    });
  });
});
