import { createHash } from "node:crypto";
import { createId } from "@paralleldrive/cuid2";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testLiveContextCreate } from "@/utils/testLiveContextCreate.js";
import { messageSend } from "./messageSend.js";

type LiveContext = Awaited<ReturnType<typeof testLiveContextCreate>>;

describe("messageSend", () => {
  let live: LiveContext;

  beforeAll(async () => {
    live = await testLiveContextCreate();
  });

  beforeEach(async () => {
    await live.reset();
  });

  afterAll(async () => {
    await live.close();
  });

  async function seedBase() {
    const orgId = createId();
    const userId = createId();
    const channelId = createId();

    await live.db.organization.create({
      data: {
        id: orgId,
        slug: `org-${createId().slice(0, 8)}`,
        name: "Acme"
      }
    });

    await live.db.user.create({
      data: {
        id: userId,
        organizationId: orgId,
        kind: "HUMAN",
        firstName: "Alice",
        username: `alice-${createId().slice(0, 6)}`
      }
    });

    await live.db.chat.create({
      data: {
        id: channelId,
        organizationId: orgId,
        createdByUserId: userId,
        kind: "CHANNEL",
        visibility: "PUBLIC",
        name: "general"
      }
    });

    await live.db.chatMember.create({
      data: {
        id: createId(),
        chatId: channelId,
        userId,
        role: "OWNER",
        notificationLevel: "ALL"
      }
    });

    return { orgId, userId, channelId };
  }

  async function seedFileAsset(orgId: string, userId: string, options?: {
    imageWidth?: number;
    imageHeight?: number;
    imageThumbhash?: string;
    mimeType?: string;
  }) {
    const fileId = createId();
    const payload = Buffer.from("test-content");
    const contentHash = createHash("sha256").update(payload).digest("hex");

    await live.db.fileAsset.create({
      data: {
        id: fileId,
        organizationId: orgId,
        createdByUserId: userId,
        storageKey: `${orgId}/${userId}/${fileId}/test.png`,
        contentHash,
        mimeType: options?.mimeType ?? "image/png",
        sizeBytes: payload.length,
        status: "COMMITTED",
        committedAt: new Date(),
        imageWidth: options?.imageWidth ?? null,
        imageHeight: options?.imageHeight ?? null,
        imageThumbhash: options?.imageThumbhash ?? null
      }
    });

    return fileId;
  }

  it("links fileId when attachment URL matches file pattern", async () => {
    const { orgId, userId, channelId } = await seedBase();
    const fileId = await seedFileAsset(orgId, userId, {
      imageWidth: 800,
      imageHeight: 600,
      imageThumbhash: "dGVzdA=="
    });

    const message = await messageSend(live.context, {
      organizationId: orgId,
      channelId,
      userId,
      text: "check this image",
      attachments: [{
        kind: "image",
        url: `/api/org/${orgId}/files/${fileId}`,
        mimeType: "image/png",
        fileName: "test.png",
        sizeBytes: 12
      }]
    });

    expect(message.attachments).toHaveLength(1);
    expect(message.attachments[0]!.fileId).toBe(fileId);
    expect(message.attachments[0]!.file).not.toBeNull();
    expect(message.attachments[0]!.file!.imageWidth).toBe(800);
    expect(message.attachments[0]!.file!.imageHeight).toBe(600);
    expect(message.attachments[0]!.file!.imageThumbhash).toBe("dGVzdA==");
  });

  it("does not set fileId for external URLs", async () => {
    const { orgId, userId, channelId } = await seedBase();

    const message = await messageSend(live.context, {
      organizationId: orgId,
      channelId,
      userId,
      text: "external link",
      attachments: [{
        kind: "link",
        url: "https://example.com/image.png",
        mimeType: "image/png"
      }]
    });

    expect(message.attachments).toHaveLength(1);
    expect(message.attachments[0]!.fileId).toBeNull();
    expect(message.attachments[0]!.file).toBeNull();
  });

  it("includes file relation with null image metadata for non-image files", async () => {
    const { orgId, userId, channelId } = await seedBase();
    const fileId = await seedFileAsset(orgId, userId, {
      mimeType: "text/plain"
    });

    const message = await messageSend(live.context, {
      organizationId: orgId,
      channelId,
      userId,
      text: "text file",
      attachments: [{
        kind: "file",
        url: `/api/org/${orgId}/files/${fileId}`,
        mimeType: "text/plain",
        fileName: "readme.txt",
        sizeBytes: 12
      }]
    });

    expect(message.attachments).toHaveLength(1);
    expect(message.attachments[0]!.fileId).toBe(fileId);
    expect(message.attachments[0]!.file).not.toBeNull();
    expect(message.attachments[0]!.file!.imageWidth).toBeNull();
    expect(message.attachments[0]!.file!.imageHeight).toBeNull();
    expect(message.attachments[0]!.file!.imageThumbhash).toBeNull();
  });

  it("does not link fileId when attachment URL references a different org", async () => {
    const { orgId, userId, channelId } = await seedBase();
    const fileId = await seedFileAsset(orgId, userId, {
      imageWidth: 800,
      imageHeight: 600,
      imageThumbhash: "dGVzdA=="
    });

    const message = await messageSend(live.context, {
      organizationId: orgId,
      channelId,
      userId,
      text: "cross-org attempt",
      attachments: [{
        kind: "image",
        url: `/api/org/different-org-id/files/${fileId}`,
        mimeType: "image/png",
        fileName: "test.png",
        sizeBytes: 12
      }]
    });

    expect(message.attachments).toHaveLength(1);
    expect(message.attachments[0]!.fileId).toBeNull();
    expect(message.attachments[0]!.file).toBeNull();
  });
});
