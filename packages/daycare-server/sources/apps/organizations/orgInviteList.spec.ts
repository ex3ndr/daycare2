import { createId } from "@paralleldrive/cuid2";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testLiveContextCreate } from "@/utils/testLiveContextCreate.js";
import { orgInviteList } from "./orgInviteList.js";

type LiveContext = Awaited<ReturnType<typeof testLiveContextCreate>>;

describe("orgInviteList", () => {
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

  async function seedOrgWithInvites() {
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

    // Create various invites
    const pendingInviteId = createId();
    const expiredInviteId = createId();
    const revokedInviteId = createId();
    const acceptedInviteId = createId();

    await live.db.orgInvite.createMany({
      data: [
        {
          id: pendingInviteId,
          organizationId: orgId,
          invitedByUserId: ownerId,
          email: "pending@company.com",
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        },
        {
          id: expiredInviteId,
          organizationId: orgId,
          invitedByUserId: ownerId,
          email: "expired@company.com",
          expiresAt: new Date(Date.now() - 1000) // in the past
        },
        {
          id: revokedInviteId,
          organizationId: orgId,
          invitedByUserId: ownerId,
          email: "revoked@company.com",
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          revokedAt: new Date()
        },
        {
          id: acceptedInviteId,
          organizationId: orgId,
          invitedByUserId: ownerId,
          email: "accepted@company.com",
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          acceptedAt: new Date()
        }
      ]
    });

    return {
      orgId, ownerId, memberId,
      pendingInviteId, expiredInviteId, revokedInviteId, acceptedInviteId
    };
  }

  it("lists all invites with correct expired status", async () => {
    const { orgId, ownerId, pendingInviteId, expiredInviteId, revokedInviteId, acceptedInviteId } = await seedOrgWithInvites();

    const invites = await orgInviteList(live.context, {
      organizationId: orgId,
      actorUserId: ownerId
    });

    expect(invites).toHaveLength(4);

    const pending = invites.find((i) => i.id === pendingInviteId)!;
    expect(pending.expired).toBe(false);
    expect(pending.revokedAt).toBeNull();
    expect(pending.acceptedAt).toBeNull();

    const expired = invites.find((i) => i.id === expiredInviteId)!;
    expect(expired.expired).toBe(true);

    // Revoked invites are not considered "expired" — they have a separate status
    const revoked = invites.find((i) => i.id === revokedInviteId)!;
    expect(revoked.expired).toBe(false);
    expect(revoked.revokedAt).not.toBeNull();

    // Accepted invites are not considered "expired"
    const accepted = invites.find((i) => i.id === acceptedInviteId)!;
    expect(accepted.expired).toBe(false);
    expect(accepted.acceptedAt).not.toBeNull();
  });

  it("allows a regular member to list invites", async () => {
    const { orgId, memberId } = await seedOrgWithInvites();

    const invites = await orgInviteList(live.context, {
      organizationId: orgId,
      actorUserId: memberId
    });

    expect(invites).toHaveLength(4);
  });

  it("rejects non-org-member from listing invites", async () => {
    const { orgId } = await seedOrgWithInvites();

    await expect(orgInviteList(live.context, {
      organizationId: orgId,
      actorUserId: createId()
    })).rejects.toMatchObject({ statusCode: 403 });
  });

  it("returns empty list when no invites exist", async () => {
    const orgId = createId();
    const userId = createId();

    await live.db.organization.create({
      data: {
        id: orgId,
        slug: `org-${createId().slice(0, 8)}`,
        name: "Empty Org"
      }
    });

    await live.db.user.create({
      data: {
        id: userId,
        organizationId: orgId,
        kind: "HUMAN",
        firstName: "Solo",
        username: `solo-${createId().slice(0, 6)}`,
        orgRole: "OWNER"
      }
    });

    const invites = await orgInviteList(live.context, {
      organizationId: orgId,
      actorUserId: userId
    });

    expect(invites).toHaveLength(0);
  });
});
