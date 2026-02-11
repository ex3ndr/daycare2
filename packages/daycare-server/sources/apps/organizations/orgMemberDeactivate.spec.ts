import { createId } from "@paralleldrive/cuid2";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testLiveContextCreate } from "@/utils/testLiveContextCreate.js";
import { orgMemberDeactivate } from "./orgMemberDeactivate.js";

type LiveContext = Awaited<ReturnType<typeof testLiveContextCreate>>;

describe("orgMemberDeactivate", () => {
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

  async function seedOrgMembers() {
    const orgId = createId();
    const ownerId = createId();
    const memberId = createId();
    const otherOwnerId = createId();
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
          username: `owner-${createId().slice(0, 6)}`,
          orgRole: "OWNER"
        },
        {
          id: memberId,
          organizationId: orgId,
          kind: "HUMAN",
          firstName: "Member",
          username: `member-${createId().slice(0, 6)}`,
          orgRole: "MEMBER"
        },
        {
          id: otherOwnerId,
          organizationId: orgId,
          kind: "HUMAN",
          firstName: "OtherOwner",
          username: `other-owner-${createId().slice(0, 6)}`,
          orgRole: "OWNER"
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
          userId: memberId,
          role: "MEMBER",
          notificationLevel: "ALL"
        }
      ]
    });

    return { orgId, ownerId, memberId, otherOwnerId, channelId };
  }

  it("deactivates a member and removes them from channels", async () => {
    const { orgId, ownerId, memberId, channelId } = await seedOrgMembers();

    const result = await orgMemberDeactivate(live.context, {
      organizationId: orgId,
      actorUserId: ownerId,
      targetUserId: memberId
    });

    expect(result.id).toBe(memberId);
    expect(result.deactivatedAt).not.toBeNull();

    // Verify channel membership was revoked
    const membership = await live.db.chatMember.findFirst({
      where: { chatId: channelId, userId: memberId }
    });
    expect(membership!.leftAt).not.toBeNull();

    // Verify SSE event was published
    const updates = await live.db.userUpdate.findMany({
      where: { eventType: "organization.member.deactivated" }
    });
    expect(updates.length).toBeGreaterThan(0);
  });

  it("rejects self-deactivation", async () => {
    const { orgId, ownerId } = await seedOrgMembers();

    await expect(orgMemberDeactivate(live.context, {
      organizationId: orgId,
      actorUserId: ownerId,
      targetUserId: ownerId
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects when actor is not an owner", async () => {
    const { orgId, memberId, ownerId } = await seedOrgMembers();

    // Member trying to deactivate the owner
    await expect(orgMemberDeactivate(live.context, {
      organizationId: orgId,
      actorUserId: memberId,
      targetUserId: ownerId
    })).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rejects deactivating another owner", async () => {
    const { orgId, ownerId, otherOwnerId } = await seedOrgMembers();

    await expect(orgMemberDeactivate(live.context, {
      organizationId: orgId,
      actorUserId: ownerId,
      targetUserId: otherOwnerId
    })).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rejects deactivating an already deactivated user", async () => {
    const { orgId, ownerId, memberId } = await seedOrgMembers();

    await live.db.user.update({
      where: { id: memberId },
      data: { deactivatedAt: new Date() }
    });

    await expect(orgMemberDeactivate(live.context, {
      organizationId: orgId,
      actorUserId: ownerId,
      targetUserId: memberId
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects when target user is not found", async () => {
    const { orgId, ownerId } = await seedOrgMembers();

    await expect(orgMemberDeactivate(live.context, {
      organizationId: orgId,
      actorUserId: ownerId,
      targetUserId: createId()
    })).rejects.toMatchObject({ statusCode: 404 });
  });
});
