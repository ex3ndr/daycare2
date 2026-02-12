import { createHash } from "node:crypto";
import { createId } from "@paralleldrive/cuid2";
import { CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
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

  async function seedPendingFile(payload: Buffer, options?: { mimeType?: string; filename?: string }) {
    const organizationId = createId();
    const userId = createId();
    const fileId = createId();
    const mimeType = options?.mimeType ?? "text/plain";
    const filename = options?.filename ?? "hello.txt";

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
        storageKey: `${organizationId}/${userId}/${fileId}/${filename}`,
        contentHash,
        mimeType,
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

  it("extracts and persists image metadata for PNG uploads", async () => {
    const payload = await sharp({
      create: { width: 200, height: 100, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } }
    }).png().toBuffer();

    const seeded = await seedPendingFile(payload, { mimeType: "image/png", filename: "test.png" });

    const result = await fileUploadCommit(live.context, {
      organizationId: seeded.organizationId,
      userId: seeded.userId,
      fileId: seeded.fileId,
      payloadBase64: payload.toString("base64")
    });

    expect(result.status).toBe("COMMITTED");
    expect(result.imageWidth).toBe(200);
    expect(result.imageHeight).toBe(100);
    expect(result.imageThumbhash).toBeTruthy();
    expect(() => Buffer.from(result.imageThumbhash!, "base64")).not.toThrow();
  });

  it("extracts and persists image metadata for JPEG uploads", async () => {
    const payload = await sharp({
      create: { width: 150, height: 300, channels: 3, background: { r: 0, g: 255, b: 0 } }
    }).jpeg().toBuffer();

    const seeded = await seedPendingFile(payload, { mimeType: "image/jpeg", filename: "test.jpg" });

    const result = await fileUploadCommit(live.context, {
      organizationId: seeded.organizationId,
      userId: seeded.userId,
      fileId: seeded.fileId,
      payloadBase64: payload.toString("base64")
    });

    expect(result.status).toBe("COMMITTED");
    expect(result.imageWidth).toBe(150);
    expect(result.imageHeight).toBe(300);
    expect(result.imageThumbhash).toBeTruthy();
  });

  it("does not set image metadata for non-image files", async () => {
    const payload = Buffer.from("hello world");
    const seeded = await seedPendingFile(payload);

    const result = await fileUploadCommit(live.context, {
      organizationId: seeded.organizationId,
      userId: seeded.userId,
      fileId: seeded.fileId,
      payloadBase64: payload.toString("base64")
    });

    expect(result.status).toBe("COMMITTED");
    expect(result.imageWidth).toBeNull();
    expect(result.imageHeight).toBeNull();
    expect(result.imageThumbhash).toBeNull();
  });

  it("rejects file when MIME claims image but content is not", async () => {
    const payload = Buffer.from("this is not an image");
    const seeded = await seedPendingFile(payload, { mimeType: "image/png", filename: "fake.png" });

    await expect(fileUploadCommit(live.context, {
      organizationId: seeded.organizationId,
      userId: seeded.userId,
      fileId: seeded.fileId,
      payloadBase64: payload.toString("base64")
    })).rejects.toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR"
    });
  });
});
