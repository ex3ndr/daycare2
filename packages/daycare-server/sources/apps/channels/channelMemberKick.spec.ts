import { createId } from "@paralleldrive/cuid2";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testLiveContextCreate } from "@/utils/testLiveContextCreate.js";
import { channelMemberKick } from "./channelMemberKick.js";

type LiveContext = Awaited<ReturnType<typeof testLiveContextCreate>>;

describe("channelMemberKick", () => {
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

  async function seedChannelMembers() {
    const orgId = createId();
    const ownerId = createId();
    const targetId = createId();
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
          id: targetId,
          organizationId: orgId,
          kind: "HUMAN",
          firstName: "Target",
          username: `target-${createId().slice(0, 6)}`
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
        name: "general"
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
          userId: targetId,
          role: "MEMBER",
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

    return { orgId, ownerId, targetId, memberId, channelId };
  }

  it("kicks a member when actor is channel owner", async () => {
    const { orgId, ownerId, targetId, memberId, channelId } = await seedChannelMembers();

    const membership = await channelMemberKick(live.context, {
      organizationId: orgId,
      channelId,
      actorUserId: ownerId,
      targetUserId: targetId
    });

    expect(membership.userId).toBe(targetId);
    expect(membership.leftAt).not.toBeNull();

    const updates = await live.db.userUpdate.findMany({ orderBy: { userId: "asc" } });
    expect(updates).toHaveLength(3);
    expect(new Set(updates.map((update) => update.userId))).toEqual(new Set([ownerId, memberId, targetId]));
    expect(new Set(updates.map((update) => update.eventType))).toEqual(new Set(["channel.member.left"]));
  });

  it("rejects kick when actor is not owner", async () => {
    const { orgId, memberId, targetId, channelId } = await seedChannelMembers();

    await expect(channelMemberKick(live.context, {
      organizationId: orgId,
      channelId,
      actorUserId: memberId,
      targetUserId: targetId
    })).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rejects self kick", async () => {
    const { orgId, ownerId, channelId } = await seedChannelMembers();

    await expect(channelMemberKick(live.context, {
      organizationId: orgId,
      channelId,
      actorUserId: ownerId,
      targetUserId: ownerId
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects kick when member already left", async () => {
    const { orgId, ownerId, targetId, channelId } = await seedChannelMembers();

    await live.db.chatMember.update({
      where: {
        chatId_userId: {
          chatId: channelId,
          userId: targetId
        }
      },
      data: {
        leftAt: new Date("2026-02-11T00:00:00.000Z")
      }
    });

    await expect(channelMemberKick(live.context, {
      organizationId: orgId,
      channelId,
      actorUserId: ownerId,
      targetUserId: targetId
    })).rejects.toMatchObject({ statusCode: 404 });
  });

  it("rejects kick when target member is an owner", async () => {
    const { orgId, ownerId, targetId, channelId } = await seedChannelMembers();

    await live.db.chatMember.update({
      where: {
        chatId_userId: {
          chatId: channelId,
          userId: targetId
        }
      },
      data: {
        role: "OWNER"
      }
    });

    await expect(channelMemberKick(live.context, {
      organizationId: orgId,
      channelId,
      actorUserId: ownerId,
      targetUserId: targetId
    })).rejects.toMatchObject({ statusCode: 403 });
  });
});
