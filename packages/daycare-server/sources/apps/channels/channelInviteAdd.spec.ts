import { createId } from "@paralleldrive/cuid2";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testLiveContextCreate } from "@/utils/testLiveContextCreate.js";
import { channelInviteAdd } from "./channelInviteAdd.js";

type LiveContext = Awaited<ReturnType<typeof testLiveContextCreate>>;

describe("channelInviteAdd", () => {
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

  async function seedPrivateChannel() {
    const orgId = createId();
    const ownerId = createId();
    const targetId = createId();
    const nonMemberId = createId();
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
          id: nonMemberId,
          organizationId: orgId,
          kind: "HUMAN",
          firstName: "NonMember",
          username: `nonmember-${createId().slice(0, 6)}`
        }
      ]
    });

    await live.db.chat.create({
      data: {
        id: channelId,
        organizationId: orgId,
        createdByUserId: ownerId,
        kind: "CHANNEL",
        visibility: "PRIVATE",
        name: "secret-channel"
      }
    });

    await live.db.chatMember.create({
      data: {
        id: createId(),
        chatId: channelId,
        userId: ownerId,
        role: "OWNER",
        notificationLevel: "ALL"
      }
    });

    return { orgId, ownerId, targetId, nonMemberId, channelId };
  }

  it("adds a member to a private channel", async () => {
    const { orgId, ownerId, targetId, channelId } = await seedPrivateChannel();

    const membership = await channelInviteAdd(live.context, {
      organizationId: orgId,
      channelId,
      actorUserId: ownerId,
      targetUserId: targetId
    });

    expect(membership.chatId).toBe(channelId);
    expect(membership.userId).toBe(targetId);
    expect(membership.role).toBe("MEMBER");
    expect(membership.leftAt).toBeNull();

    // Verify SSE event published to channel members
    const updates = await live.db.userUpdate.findMany({ orderBy: { userId: "asc" } });
    expect(updates.length).toBeGreaterThanOrEqual(1);
    expect(updates.every((u) => u.eventType === "channel.member.joined")).toBe(true);
  });

  it("returns existing membership when user is already a member", async () => {
    const { orgId, ownerId, targetId, channelId } = await seedPrivateChannel();

    // Add target first
    const first = await channelInviteAdd(live.context, {
      organizationId: orgId,
      channelId,
      actorUserId: ownerId,
      targetUserId: targetId
    });

    // Adding again should be idempotent
    const second = await channelInviteAdd(live.context, {
      organizationId: orgId,
      channelId,
      actorUserId: ownerId,
      targetUserId: targetId
    });

    expect(second.id).toBe(first.id);
  });

  it("reactivates a historical membership", async () => {
    const { orgId, ownerId, targetId, channelId } = await seedPrivateChannel();

    // Create and leave membership
    const historicalId = createId();
    await live.db.chatMember.create({
      data: {
        id: historicalId,
        chatId: channelId,
        userId: targetId,
        role: "MEMBER",
        notificationLevel: "ALL",
        leftAt: new Date("2025-01-01T00:00:00.000Z")
      }
    });

    const membership = await channelInviteAdd(live.context, {
      organizationId: orgId,
      channelId,
      actorUserId: ownerId,
      targetUserId: targetId
    });

    expect(membership.id).toBe(historicalId);
    expect(membership.leftAt).toBeNull();
  });

  it("rejects when actor is not channel owner", async () => {
    const { orgId, nonMemberId, targetId, channelId } = await seedPrivateChannel();

    await expect(channelInviteAdd(live.context, {
      organizationId: orgId,
      channelId,
      actorUserId: nonMemberId,
      targetUserId: targetId
    })).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rejects when actor is channel member but not owner", async () => {
    const { orgId, ownerId, targetId, nonMemberId, channelId } = await seedPrivateChannel();

    // Add nonMemberId as a regular member of the channel
    await live.db.chatMember.create({
      data: {
        id: createId(),
        chatId: channelId,
        userId: nonMemberId,
        role: "MEMBER",
        notificationLevel: "ALL"
      }
    });

    await expect(channelInviteAdd(live.context, {
      organizationId: orgId,
      channelId,
      actorUserId: nonMemberId,
      targetUserId: targetId
    })).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rejects when channel is public", async () => {
    const { orgId, ownerId, targetId } = await seedPrivateChannel();
    const publicChannelId = createId();

    await live.db.chat.create({
      data: {
        id: publicChannelId,
        organizationId: orgId,
        createdByUserId: ownerId,
        kind: "CHANNEL",
        visibility: "PUBLIC",
        name: "public-channel"
      }
    });

    await live.db.chatMember.create({
      data: {
        id: createId(),
        chatId: publicChannelId,
        userId: ownerId,
        role: "OWNER",
        notificationLevel: "ALL"
      }
    });

    await expect(channelInviteAdd(live.context, {
      organizationId: orgId,
      channelId: publicChannelId,
      actorUserId: ownerId,
      targetUserId: targetId
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects when target user is not in the organization", async () => {
    const { orgId, ownerId, channelId } = await seedPrivateChannel();
    const outsideUserId = createId();

    await expect(channelInviteAdd(live.context, {
      organizationId: orgId,
      channelId,
      actorUserId: ownerId,
      targetUserId: outsideUserId
    })).rejects.toMatchObject({ statusCode: 404 });
  });

  it("rejects when target user is deactivated", async () => {
    const { orgId, ownerId, targetId, channelId } = await seedPrivateChannel();

    await live.db.user.update({
      where: { id: targetId },
      data: { deactivatedAt: new Date() }
    });

    await expect(channelInviteAdd(live.context, {
      organizationId: orgId,
      channelId,
      actorUserId: ownerId,
      targetUserId: targetId
    })).rejects.toMatchObject({ statusCode: 403 });
  });
});
