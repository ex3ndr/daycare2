import { createId } from "@paralleldrive/cuid2";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testLiveContextCreate } from "@/utils/testLiveContextCreate.js";
import { orgMemberRoleSet } from "./orgMemberRoleSet.js";

type LiveContext = Awaited<ReturnType<typeof testLiveContextCreate>>;

describe("orgMemberRoleSet", () => {
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
        }
      ]
    });

    return { orgId, ownerId, memberId };
  }

  it("promotes a member to owner", async () => {
    const { orgId, ownerId, memberId } = await seedOrgMembers();

    const result = await orgMemberRoleSet(live.context, {
      organizationId: orgId,
      actorUserId: ownerId,
      targetUserId: memberId,
      role: "OWNER"
    });

    expect(result.id).toBe(memberId);
    expect(result.orgRole).toBe("OWNER");

    // Verify SSE event was published
    const updates = await live.db.userUpdate.findMany({
      where: { eventType: "organization.member.updated" }
    });
    expect(updates.length).toBeGreaterThan(0);
  });

  it("demotes an owner to member", async () => {
    const { orgId, ownerId, memberId } = await seedOrgMembers();

    // First promote the member to owner
    await orgMemberRoleSet(live.context, {
      organizationId: orgId,
      actorUserId: ownerId,
      targetUserId: memberId,
      role: "OWNER"
    });

    // Now demote them back
    const result = await orgMemberRoleSet(live.context, {
      organizationId: orgId,
      actorUserId: ownerId,
      targetUserId: memberId,
      role: "MEMBER"
    });

    expect(result.id).toBe(memberId);
    expect(result.orgRole).toBe("MEMBER");
  });

  it("rejects self-demotion", async () => {
    const { orgId, ownerId } = await seedOrgMembers();

    await expect(orgMemberRoleSet(live.context, {
      organizationId: orgId,
      actorUserId: ownerId,
      targetUserId: ownerId,
      role: "MEMBER"
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects when actor is not an owner", async () => {
    const { orgId, ownerId, memberId } = await seedOrgMembers();

    await expect(orgMemberRoleSet(live.context, {
      organizationId: orgId,
      actorUserId: memberId,
      targetUserId: ownerId,
      role: "MEMBER"
    })).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rejects when target is not found", async () => {
    const { orgId, ownerId } = await seedOrgMembers();

    await expect(orgMemberRoleSet(live.context, {
      organizationId: orgId,
      actorUserId: ownerId,
      targetUserId: createId(),
      role: "OWNER"
    })).rejects.toMatchObject({ statusCode: 404 });
  });

  it("rejects when target already has the requested role", async () => {
    const { orgId, ownerId, memberId } = await seedOrgMembers();

    await expect(orgMemberRoleSet(live.context, {
      organizationId: orgId,
      actorUserId: ownerId,
      targetUserId: memberId,
      role: "MEMBER"
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects role change on a deactivated user", async () => {
    const { orgId, ownerId, memberId } = await seedOrgMembers();

    await live.db.user.update({
      where: { id: memberId },
      data: { deactivatedAt: new Date() }
    });

    await expect(orgMemberRoleSet(live.context, {
      organizationId: orgId,
      actorUserId: ownerId,
      targetUserId: memberId,
      role: "OWNER"
    })).rejects.toMatchObject({ statusCode: 400 });
  });
});
