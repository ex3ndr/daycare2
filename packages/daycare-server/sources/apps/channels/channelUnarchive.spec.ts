import { createId } from "@paralleldrive/cuid2";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testLiveContextCreate } from "@/utils/testLiveContextCreate.js";
import { channelUnarchive } from "./channelUnarchive.js";

type LiveContext = Awaited<ReturnType<typeof testLiveContextCreate>>;

describe("channelUnarchive", () => {
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

  async function seedArchivedChannel() {
    const orgId = createId();
    const ownerId = createId();
    const memberId = createId();
    const channelId = createId();

    await live.db.organization.create({
      data: {
        id: orgId,
        slug: `org-${createId().slice(0, 8)}`,
        name: "Acme"
      }
    });

    await live.db.user.createMany({
      data: [
        {
          id: ownerId,
          organizationId: orgId,
          kind: "HUMAN",
          firstName: "Owner",
          username: `owner-${createId().slice(0, 6)}`
        },
        {
          id: memberId,
          organizationId: orgId,
          kind: "HUMAN",
          firstName: "Member",
          username: `member-${createId().slice(0, 6)}`
        }
      ]
    });

    await live.db.chat.create({
      data: {
        id: channelId,
        organizationId: orgId,
        createdByUserId: ownerId,
        kind: "CHANNEL",
        visibility: "PUBLIC",
        name: "general",
        archivedAt: new Date("2026-02-11T00:00:00.000Z")
      }
    });

    await live.db.chatMember.createMany({
      data: [
        {
          id: createId(),
          chatId: channelId,
          userId: ownerId,
          role: "OWNER",
          notificationLevel: "ALL"
        },
        {
          id: createId(),
          chatId: channelId,
          userId: memberId,
          role: "MEMBER",
          notificationLevel: "ALL"
        }
      ]
    });

    return { orgId, ownerId, channelId, memberId };
  }

  it("unarchives a channel when actor is owner", async () => {
    const { orgId, ownerId, channelId, memberId } = await seedArchivedChannel();

    const channel = await channelUnarchive(live.context, {
      organizationId: orgId,
      channelId,
      actorUserId: ownerId
    });

    expect(channel.archivedAt).toBeNull();

    const updates = await live.db.userUpdate.findMany({ orderBy: { userId: "asc" } });
    expect(updates).toHaveLength(2);
    expect(new Set(updates.map((update) => update.userId))).toEqual(new Set([ownerId, memberId]));
    expect(new Set(updates.map((update) => update.eventType))).toEqual(new Set(["channel.updated"]));
  });

  it("rejects unarchive when channel is not archived", async () => {
    const { orgId, ownerId, channelId } = await seedArchivedChannel();
    await live.db.chat.update({
      where: { id: channelId },
      data: { archivedAt: null }
    });

    await expect(channelUnarchive(live.context, {
      organizationId: orgId,
      channelId,
      actorUserId: ownerId
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects unarchive for direct chats", async () => {
    const { orgId, ownerId } = await seedArchivedChannel();
    const directId = createId();

    await live.db.chat.create({
      data: {
        id: directId,
        organizationId: orgId,
        createdByUserId: ownerId,
        kind: "DIRECT",
        visibility: "PRIVATE",
        directKey: [ownerId, createId()].sort().join(":")
      }
    });

    await expect(channelUnarchive(live.context, {
      organizationId: orgId,
      channelId: directId,
      actorUserId: ownerId
    })).rejects.toMatchObject({ statusCode: 404 });
  });
});
