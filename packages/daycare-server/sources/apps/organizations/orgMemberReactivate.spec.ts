import { createId } from "@paralleldrive/cuid2";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testLiveContextCreate } from "@/utils/testLiveContextCreate.js";
import { orgMemberReactivate } from "./orgMemberReactivate.js";

type LiveContext = Awaited<ReturnType<typeof testLiveContextCreate>>;

describe("orgMemberReactivate", () => {
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

  async function seedOrgWithDeactivatedMember() {
    const orgId = createId();
    const ownerId = createId();
    const deactivatedId = createId();
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
          id: deactivatedId,
          organizationId: orgId,
          kind: "HUMAN",
          firstName: "Deactivated",
          username: `deactivated-${createId().slice(0, 6)}`,
          orgRole: "MEMBER",
          deactivatedAt: new Date()
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

    return { orgId, ownerId, deactivatedId, memberId };
  }

  it("reactivates a deactivated member", async () => {
    const { orgId, ownerId, deactivatedId } = await seedOrgWithDeactivatedMember();

    const result = await orgMemberReactivate(live.context, {
      organizationId: orgId,
      actorUserId: ownerId,
      targetUserId: deactivatedId
    });

    expect(result.id).toBe(deactivatedId);
    expect(result.deactivatedAt).toBeNull();

    // Verify SSE event was published
    const updates = await live.db.userUpdate.findMany({
      where: { eventType: "organization.member.reactivated" }
    });
    expect(updates.length).toBeGreaterThan(0);
  });

  it("rejects when actor is not an owner", async () => {
    const { orgId, memberId, deactivatedId } = await seedOrgWithDeactivatedMember();

    await expect(orgMemberReactivate(live.context, {
      organizationId: orgId,
      actorUserId: memberId,
      targetUserId: deactivatedId
    })).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rejects reactivating an already active user", async () => {
    const { orgId, ownerId, memberId } = await seedOrgWithDeactivatedMember();

    await expect(orgMemberReactivate(live.context, {
      organizationId: orgId,
      actorUserId: ownerId,
      targetUserId: memberId
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects when target user is not found", async () => {
    const { orgId, ownerId } = await seedOrgWithDeactivatedMember();

    await expect(orgMemberReactivate(live.context, {
      organizationId: orgId,
      actorUserId: ownerId,
      targetUserId: createId()
    })).rejects.toMatchObject({ statusCode: 404 });
  });
});
