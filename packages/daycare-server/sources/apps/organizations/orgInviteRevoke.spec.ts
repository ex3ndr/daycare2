import { createId } from "@paralleldrive/cuid2";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testLiveContextCreate } from "@/utils/testLiveContextCreate.js";
import { orgInviteRevoke } from "./orgInviteRevoke.js";

type LiveContext = Awaited<ReturnType<typeof testLiveContextCreate>>;

describe("orgInviteRevoke", () => {
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

  async function seedOrgWithInvite() {
    const orgId = createId();
    const ownerId = createId();
    const memberId = createId();
    const inviteId = createId();

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

    await live.db.orgInvite.create({
      data: {
        id: inviteId,
        organizationId: orgId,
        invitedByUserId: ownerId,
        email: "invited@company.com",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });

    return { orgId, ownerId, memberId, inviteId };
  }

  it("revokes a pending invite successfully", async () => {
    const { orgId, ownerId, inviteId } = await seedOrgWithInvite();

    const result = await orgInviteRevoke(live.context, {
      organizationId: orgId,
      actorUserId: ownerId,
      inviteId
    });

    expect(result.id).toBe(inviteId);
    expect(result.revokedAt).not.toBeNull();

    // Verify SSE event was published
    const updates = await live.db.userUpdate.findMany({
      where: { eventType: "organization.invite.revoked" }
    });
    expect(updates.length).toBeGreaterThan(0);
  });

  it("rejects revoking an already accepted invite", async () => {
    const { orgId, ownerId, inviteId } = await seedOrgWithInvite();

    await live.db.orgInvite.update({
      where: { id: inviteId },
      data: { acceptedAt: new Date() }
    });

    await expect(orgInviteRevoke(live.context, {
      organizationId: orgId,
      actorUserId: ownerId,
      inviteId
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects revoking an already revoked invite", async () => {
    const { orgId, ownerId, inviteId } = await seedOrgWithInvite();

    await live.db.orgInvite.update({
      where: { id: inviteId },
      data: { revokedAt: new Date() }
    });

    await expect(orgInviteRevoke(live.context, {
      organizationId: orgId,
      actorUserId: ownerId,
      inviteId
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects when actor is not an owner", async () => {
    const { orgId, memberId, inviteId } = await seedOrgWithInvite();

    await expect(orgInviteRevoke(live.context, {
      organizationId: orgId,
      actorUserId: memberId,
      inviteId
    })).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rejects when invite is not found", async () => {
    const { orgId, ownerId } = await seedOrgWithInvite();

    await expect(orgInviteRevoke(live.context, {
      organizationId: orgId,
      actorUserId: ownerId,
      inviteId: createId()
    })).rejects.toMatchObject({ statusCode: 404 });
  });
});
