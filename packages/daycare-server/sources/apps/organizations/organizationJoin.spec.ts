import { createId } from "@paralleldrive/cuid2";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { testLiveContextCreate } from "@/utils/testLiveContextCreate.js";
import { organizationJoin } from "./organizationJoin.js";

type LiveContext = Awaited<ReturnType<typeof testLiveContextCreate>>;

describe("organizationJoin", () => {
  let live: LiveContext;
  let restrictedContext: ApiContext;

  beforeAll(async () => {
    live = await testLiveContextCreate();
    restrictedContext = { ...live.context, allowOpenOrgJoin: false };
  });

  beforeEach(async () => {
    await live.reset();
  });

  afterAll(async () => {
    await live.close();
  });

  async function seedPrivateOrg() {
    const orgId = createId();
    const ownerId = createId();
    const ownerAccountId = createId();
    const joinerAccountId = createId();

    await live.db.account.createMany({
      data: [
        { id: ownerAccountId, email: `owner-${createId().slice(0, 6)}@test.com` },
        { id: joinerAccountId, email: `joiner-${createId().slice(0, 6)}@company.com` }
      ]
    });

    await live.db.organization.create({
      data: {
        id: orgId,
        slug: `org-${createId().slice(0, 8)}`,
        name: "Private Org",
        public: false
      }
    });

    await live.db.user.create({
      data: {
        id: ownerId,
        organizationId: orgId,
        accountId: ownerAccountId,
        kind: "HUMAN",
        firstName: "Owner",
        username: `owner-${createId().slice(0, 6)}`,
        orgRole: "OWNER"
      }
    });

    return { orgId, ownerId, ownerAccountId, joinerAccountId };
  }

  async function seedPublicOrg() {
    const orgId = createId();
    const joinerAccountId = createId();

    await live.db.account.create({
      data: { id: joinerAccountId, email: `joiner-${createId().slice(0, 6)}@test.com` }
    });

    await live.db.organization.create({
      data: {
        id: orgId,
        slug: `org-${createId().slice(0, 8)}`,
        name: "Public Org",
        public: true
      }
    });

    return { orgId, joinerAccountId };
  }

  // --- Join via invite ---

  it("allows joining a private org via a valid invite", async () => {
    const { orgId, ownerId, joinerAccountId } = await seedPrivateOrg();
    const joinerEmail = (await live.db.account.findUniqueOrThrow({ where: { id: joinerAccountId } })).email;

    const inviteId = createId();
    await live.db.orgInvite.create({
      data: {
        id: inviteId,
        organizationId: orgId,
        invitedByUserId: ownerId,
        email: joinerEmail,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });

    const result = await organizationJoin(restrictedContext, {
      accountId: joinerAccountId,
      organizationId: orgId,
      firstName: "Joiner",
      username: `joiner-${createId().slice(0, 6)}`
    });

    expect(result.user.organizationId).toBe(orgId);
    expect(result.user.accountId).toBe(joinerAccountId);

    // Verify invite was marked as accepted
    const invite = await live.db.orgInvite.findUniqueOrThrow({ where: { id: inviteId } });
    expect(invite.acceptedAt).not.toBeNull();
  });

  it("blocks joining via an expired invite", async () => {
    const { orgId, ownerId, joinerAccountId } = await seedPrivateOrg();
    const joinerEmail = (await live.db.account.findUniqueOrThrow({ where: { id: joinerAccountId } })).email;

    await live.db.orgInvite.create({
      data: {
        id: createId(),
        organizationId: orgId,
        invitedByUserId: ownerId,
        email: joinerEmail,
        expiresAt: new Date(Date.now() - 1000) // expired
      }
    });

    await expect(organizationJoin(restrictedContext, {
      accountId: joinerAccountId,
      organizationId: orgId,
      firstName: "Joiner",
      username: `joiner-${createId().slice(0, 6)}`
    })).rejects.toMatchObject({ statusCode: 403 });
  });

  it("blocks joining via a revoked invite", async () => {
    const { orgId, ownerId, joinerAccountId } = await seedPrivateOrg();
    const joinerEmail = (await live.db.account.findUniqueOrThrow({ where: { id: joinerAccountId } })).email;

    await live.db.orgInvite.create({
      data: {
        id: createId(),
        organizationId: orgId,
        invitedByUserId: ownerId,
        email: joinerEmail,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        revokedAt: new Date()
      }
    });

    await expect(organizationJoin(restrictedContext, {
      accountId: joinerAccountId,
      organizationId: orgId,
      firstName: "Joiner",
      username: `joiner-${createId().slice(0, 6)}`
    })).rejects.toMatchObject({ statusCode: 403 });
  });

  // --- Join via domain ---

  it("allows joining a private org via domain match", async () => {
    const { orgId, ownerId, joinerAccountId } = await seedPrivateOrg();
    const joinerEmail = (await live.db.account.findUniqueOrThrow({ where: { id: joinerAccountId } })).email;
    const domain = joinerEmail.split("@")[1]!;

    await live.db.orgDomain.create({
      data: {
        id: createId(),
        organizationId: orgId,
        createdByUserId: ownerId,
        domain
      }
    });

    const result = await organizationJoin(restrictedContext, {
      accountId: joinerAccountId,
      organizationId: orgId,
      firstName: "Joiner",
      username: `joiner-${createId().slice(0, 6)}`
    });

    expect(result.user.organizationId).toBe(orgId);
    expect(result.user.accountId).toBe(joinerAccountId);
  });

  it("blocks joining when email domain is not in allowlist", async () => {
    const { orgId, ownerId } = await seedPrivateOrg();
    const outsiderAccountId = createId();

    await live.db.account.create({
      data: { id: outsiderAccountId, email: `outsider-${createId().slice(0, 6)}@other-domain.com` }
    });

    await live.db.orgDomain.create({
      data: {
        id: createId(),
        organizationId: orgId,
        createdByUserId: ownerId,
        domain: "company.com"
      }
    });

    await expect(organizationJoin(restrictedContext, {
      accountId: outsiderAccountId,
      organizationId: orgId,
      firstName: "Outsider",
      username: `outsider-${createId().slice(0, 6)}`
    })).rejects.toMatchObject({ statusCode: 403 });
  });

  // --- Deactivation block ---

  it("blocks joining when user was previously deactivated", async () => {
    const { orgId, joinerAccountId } = await seedPrivateOrg();

    await live.db.user.create({
      data: {
        id: createId(),
        organizationId: orgId,
        accountId: joinerAccountId,
        kind: "HUMAN",
        firstName: "Deactivated",
        username: `deactivated-${createId().slice(0, 6)}`,
        deactivatedAt: new Date()
      }
    });

    // Deactivation check applies even with allowOpenOrgJoin
    await expect(organizationJoin(live.context, {
      accountId: joinerAccountId,
      organizationId: orgId,
      firstName: "Joiner",
      username: `joiner-${createId().slice(0, 6)}`
    })).rejects.toMatchObject({ statusCode: 403 });
  });

  // --- Public org ---

  it("allows joining a public org without invite or domain", async () => {
    const { orgId, joinerAccountId } = await seedPublicOrg();

    const result = await organizationJoin(restrictedContext, {
      accountId: joinerAccountId,
      organizationId: orgId,
      firstName: "Joiner",
      username: `joiner-${createId().slice(0, 6)}`
    });

    expect(result.user.organizationId).toBe(orgId);
    expect(result.organization.public).toBe(true);
  });

  // --- Private org without invite/domain ---

  it("blocks joining a private org without invite or domain", async () => {
    const { orgId, joinerAccountId } = await seedPrivateOrg();

    await expect(organizationJoin(restrictedContext, {
      accountId: joinerAccountId,
      organizationId: orgId,
      firstName: "Joiner",
      username: `joiner-${createId().slice(0, 6)}`
    })).rejects.toMatchObject({ statusCode: 403 });
  });

  // --- Idempotency ---

  it("returns existing user if already a member", async () => {
    const { orgId, joinerAccountId } = await seedPublicOrg();
    const username = `joiner-${createId().slice(0, 6)}`;

    const result1 = await organizationJoin(live.context, {
      accountId: joinerAccountId,
      organizationId: orgId,
      firstName: "Joiner",
      username
    });

    const result2 = await organizationJoin(live.context, {
      accountId: joinerAccountId,
      organizationId: orgId,
      firstName: "Joiner",
      username
    });

    expect(result2.user.id).toBe(result1.user.id);
  });

  // --- Not found ---

  it("throws 404 for non-existent organization", async () => {
    const accountId = createId();
    await live.db.account.create({
      data: { id: accountId, email: `test-${createId().slice(0, 6)}@test.com` }
    });

    await expect(organizationJoin(live.context, {
      accountId,
      organizationId: createId(),
      firstName: "Test",
      username: `test-${createId().slice(0, 6)}`
    })).rejects.toMatchObject({ statusCode: 404 });
  });
});
