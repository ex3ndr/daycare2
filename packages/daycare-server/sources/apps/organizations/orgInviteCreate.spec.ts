import { createId } from "@paralleldrive/cuid2";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testLiveContextCreate } from "@/utils/testLiveContextCreate.js";
import { orgInviteCreate } from "./orgInviteCreate.js";

type LiveContext = Awaited<ReturnType<typeof testLiveContextCreate>>;

describe("orgInviteCreate", () => {
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

  async function seedOrg() {
    const orgId = createId();
    const ownerId = createId();
    const memberId = createId();
    const ownerAccountId = createId();
    const existingAccountId = createId();
    const existingUserId = createId();

    await live.db.organization.create({
      data: {
        id: orgId,
        slug: `org-${createId().slice(0, 8)}`,
        name: "Acme"
      }
    });

    await live.db.account.create({
      data: {
        id: ownerAccountId,
        email: `owner-${createId().slice(0, 6)}@test.com`
      }
    });

    await live.db.account.create({
      data: {
        id: existingAccountId,
        email: "existing@company.com"
      }
    });

    await live.db.user.createMany({
      data: [
        {
          id: ownerId,
          organizationId: orgId,
          accountId: ownerAccountId,
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
          id: existingUserId,
          organizationId: orgId,
          accountId: existingAccountId,
          kind: "HUMAN",
          firstName: "Existing",
          username: `existing-${createId().slice(0, 6)}`,
          orgRole: "MEMBER"
        }
      ]
    });

    return { orgId, ownerId, memberId, existingAccountId, existingUserId };
  }

  it("creates an invite successfully", async () => {
    const { orgId, ownerId } = await seedOrg();

    const invite = await orgInviteCreate(live.context, {
      organizationId: orgId,
      actorUserId: ownerId,
      email: "newuser@company.com"
    });

    expect(invite.organizationId).toBe(orgId);
    expect(invite.invitedByUserId).toBe(ownerId);
    expect(invite.email).toBe("newuser@company.com");
    expect(invite.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(invite.acceptedAt).toBeNull();
    expect(invite.revokedAt).toBeNull();

    // Verify SSE event was published
    const updates = await live.db.userUpdate.findMany({
      where: { eventType: "organization.invite.created" }
    });
    expect(updates.length).toBeGreaterThan(0);
  });

  it("normalizes email to lowercase", async () => {
    const { orgId, ownerId } = await seedOrg();

    const invite = await orgInviteCreate(live.context, {
      organizationId: orgId,
      actorUserId: ownerId,
      email: "NewUser@Company.COM"
    });

    expect(invite.email).toBe("newuser@company.com");
  });

  it("rejects when a pending invite already exists for this email", async () => {
    const { orgId, ownerId } = await seedOrg();

    await orgInviteCreate(live.context, {
      organizationId: orgId,
      actorUserId: ownerId,
      email: "newuser@company.com"
    });

    await expect(orgInviteCreate(live.context, {
      organizationId: orgId,
      actorUserId: ownerId,
      email: "newuser@company.com"
    })).rejects.toMatchObject({ statusCode: 409 });
  });

  it("rejects when email is already an active org member", async () => {
    const { orgId, ownerId } = await seedOrg();

    await expect(orgInviteCreate(live.context, {
      organizationId: orgId,
      actorUserId: ownerId,
      email: "existing@company.com"
    })).rejects.toMatchObject({ statusCode: 409 });
  });

  it("rejects when actor is not an owner", async () => {
    const { orgId, memberId } = await seedOrg();

    await expect(orgInviteCreate(live.context, {
      organizationId: orgId,
      actorUserId: memberId,
      email: "newuser@company.com"
    })).rejects.toMatchObject({ statusCode: 403 });
  });

  it("re-creates invite when previous one was revoked", async () => {
    const { orgId, ownerId } = await seedOrg();

    const invite1 = await orgInviteCreate(live.context, {
      organizationId: orgId,
      actorUserId: ownerId,
      email: "newuser@company.com"
    });

    // Revoke the invite
    await live.db.orgInvite.update({
      where: { id: invite1.id },
      data: { revokedAt: new Date() }
    });

    // Should succeed because previous invite was revoked
    const invite2 = await orgInviteCreate(live.context, {
      organizationId: orgId,
      actorUserId: ownerId,
      email: "newuser@company.com"
    });

    expect(invite2.id).toBe(invite1.id); // Same record, updated
    expect(invite2.revokedAt).toBeNull();
    expect(invite2.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("re-creates invite when previous one expired", async () => {
    const { orgId, ownerId } = await seedOrg();

    const invite1 = await orgInviteCreate(live.context, {
      organizationId: orgId,
      actorUserId: ownerId,
      email: "newuser@company.com"
    });

    // Set expiry to the past
    await live.db.orgInvite.update({
      where: { id: invite1.id },
      data: { expiresAt: new Date(Date.now() - 1000) }
    });

    // Should succeed because previous invite expired
    const invite2 = await orgInviteCreate(live.context, {
      organizationId: orgId,
      actorUserId: ownerId,
      email: "newuser@company.com"
    });

    expect(invite2.id).toBe(invite1.id);
    expect(invite2.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});
