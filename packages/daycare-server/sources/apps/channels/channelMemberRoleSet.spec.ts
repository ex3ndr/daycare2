import { createId } from "@paralleldrive/cuid2";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testLiveContextCreate } from "@/utils/testLiveContextCreate.js";
import { channelMemberRoleSet } from "./channelMemberRoleSet.js";

type LiveContext = Awaited<ReturnType<typeof testLiveContextCreate>>;

describe("channelMemberRoleSet", () => {
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
    const ownerTwoId = createId();
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
          id: ownerTwoId,
          organizationId: orgId,
          kind: "HUMAN",
          firstName: "Owner Two",
          username: `owner2-${createId().slice(0, 6)}`
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
          userId: ownerTwoId,
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

    return { orgId, ownerId, targetId, ownerTwoId, memberId, channelId };
  }

  it("promotes a member to owner", async () => {
    const { orgId, ownerId, targetId, channelId } = await seedChannelMembers();

    const membership = await channelMemberRoleSet(live.context, {
      organizationId: orgId,
      channelId,
      actorUserId: ownerId,
      targetUserId: targetId,
      role: "OWNER"
    });

    expect(membership.role).toBe("OWNER");

    const updates = await live.db.userUpdate.findMany();
    expect(updates.length).toBeGreaterThanOrEqual(1);
    expect(new Set(updates.map((update) => update.eventType))).toEqual(new Set(["channel.member.updated"]));
  });

  it("demotes an owner when another owner exists", async () => {
    const { orgId, ownerId, ownerTwoId, channelId } = await seedChannelMembers();

    const membership = await channelMemberRoleSet(live.context, {
      organizationId: orgId,
      channelId,
      actorUserId: ownerId,
      targetUserId: ownerTwoId,
      role: "MEMBER"
    });

    expect(membership.role).toBe("MEMBER");
  });

  it("rejects role change when actor is not owner", async () => {
    const { orgId, memberId, targetId, channelId } = await seedChannelMembers();

    await expect(channelMemberRoleSet(live.context, {
      organizationId: orgId,
      channelId,
      actorUserId: memberId,
      targetUserId: targetId,
      role: "OWNER"
    })).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rejects self role changes", async () => {
    const { orgId, ownerId, channelId } = await seedChannelMembers();

    await expect(channelMemberRoleSet(live.context, {
      organizationId: orgId,
      channelId,
      actorUserId: ownerId,
      targetUserId: ownerId,
      role: "OWNER"
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects role change when target member is missing", async () => {
    const { orgId, ownerId, channelId } = await seedChannelMembers();

    await expect(channelMemberRoleSet(live.context, {
      organizationId: orgId,
      channelId,
      actorUserId: ownerId,
      targetUserId: createId(),
      role: "MEMBER"
    })).rejects.toMatchObject({ statusCode: 404 });
  });
});
