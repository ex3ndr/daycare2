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

  it("links fileId when attachment references a committed file in org", async () => {
    const { orgId, userId, channelId } = await seedBase();
    const fileId = await seedFileAsset(orgId, userId, {
      imageWidth: 800,
      imageHeight: 600,
      imageThumbhash: "dGVzdA=="
    });

    const message = await messageSend(live.context, {
      messageId: createId(),
      organizationId: orgId,
      channelId,
      userId,
      text: "check this image",
      attachments: [{
        kind: "image",
        fileId,
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

  it("rejects attachments with unknown fileIds", async () => {
    const { orgId, userId, channelId } = await seedBase();

    await expect(messageSend(live.context, {
      messageId: createId(),
      organizationId: orgId,
      channelId,
      userId,
      text: "external link",
      attachments: [{
        kind: "link",
        fileId: createId(),
        mimeType: "image/png"
      }]
    })).rejects.toThrow("One or more attachments are invalid");
  });

  it("includes file relation with null image metadata for non-image files", async () => {
    const { orgId, userId, channelId } = await seedBase();
    const fileId = await seedFileAsset(orgId, userId, {
      mimeType: "text/plain"
    });

    const message = await messageSend(live.context, {
      messageId: createId(),
      organizationId: orgId,
      channelId,
      userId,
      text: "text file",
      attachments: [{
        kind: "file",
        fileId,
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

  it("rejects attachments when fileId belongs to a different org", async () => {
    const { orgId, userId, channelId } = await seedBase();
    const { orgId: otherOrgId, userId: otherUserId } = await seedBase();
    const otherOrgFileId = await seedFileAsset(otherOrgId, otherUserId, {
      imageWidth: 800,
      imageHeight: 600,
      imageThumbhash: "dGVzdA=="
    });

    await expect(messageSend(live.context, {
      messageId: createId(),
      organizationId: orgId,
      channelId,
      userId,
      text: "cross-org attempt",
      attachments: [{
        kind: "image",
        fileId: otherOrgFileId,
        mimeType: "image/png",
        fileName: "test.png",
        sizeBytes: 12
      }]
    })).rejects.toThrow("One or more attachments are invalid");
  });

  it("returns existing message when messageId is reused in the same chat by the same user", async () => {
    const { orgId, userId, channelId } = await seedBase();
    const messageId = createId();

    const first = await messageSend(live.context, {
      messageId,
      organizationId: orgId,
      channelId,
      userId,
      text: "hello"
    });

    const second = await messageSend(live.context, {
      messageId,
      organizationId: orgId,
      channelId,
      userId,
      text: "hello again"
    });

    expect(first.id).toBe(messageId);
    expect(second.id).toBe(messageId);

    const count = await live.db.message.count({
      where: {
        id: messageId
      }
    });
    expect(count).toBe(1);
  });

  it("rejects messageId reuse across chats", async () => {
    const { orgId, userId, channelId } = await seedBase();
    const secondChannelId = createId();
    const messageId = createId();

    await live.db.chat.create({
      data: {
        id: secondChannelId,
        organizationId: orgId,
        createdByUserId: userId,
        kind: "CHANNEL",
        visibility: "PUBLIC",
        name: "random"
      }
    });

    await live.db.chatMember.create({
      data: {
        id: createId(),
        chatId: secondChannelId,
        userId,
        role: "OWNER",
        notificationLevel: "ALL"
      }
    });

    await messageSend(live.context, {
      messageId,
      organizationId: orgId,
      channelId,
      userId,
      text: "hello"
    });

    await expect(messageSend(live.context, {
      messageId,
      organizationId: orgId,
      channelId: secondChannelId,
      userId,
      text: "hello from other channel"
    })).rejects.toThrow("Message id already belongs to another chat");
  });

  it("rejects invalid non-cuid2 message ids", async () => {
    const { orgId, userId, channelId } = await seedBase();

    await expect(messageSend(live.context, {
      messageId: "not-a-cuid",
      organizationId: orgId,
      channelId,
      userId,
      text: "hello"
    })).rejects.toThrow("Invalid messageId");
  });
});
