import { createId } from "@paralleldrive/cuid2";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testLiveContextCreate } from "@/utils/testLiveContextCreate.js";
import { organizationAvailableResolve } from "./organizationAvailableResolve.js";

type LiveContext = Awaited<ReturnType<typeof testLiveContextCreate>>;

describe("organizationAvailableResolve", () => {
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

  it("returns owned organizations and public organizations", async () => {
    const accountId = createId();
    const otherAccountId = createId();
    const ownedPrivateOrgId = createId();
    const ownedPublicOrgId = createId();
    const otherPublicOrgId = createId();
    const otherPrivateOrgId = createId();

    await live.db.account.createMany({
      data: [
        {
          id: accountId,
          email: `owner-${createId().slice(0, 8)}@example.com`
        },
        {
          id: otherAccountId,
          email: `other-${createId().slice(0, 8)}@example.com`
        }
      ]
    });

    await live.db.organization.createMany({
      data: [
        {
          id: ownedPrivateOrgId,
          slug: `org-${createId().slice(0, 8)}`,
          name: "Owned Private",
          public: false
        },
        {
          id: ownedPublicOrgId,
          slug: `org-${createId().slice(0, 8)}`,
          name: "Owned Public",
          public: true
        },
        {
          id: otherPublicOrgId,
          slug: `org-${createId().slice(0, 8)}`,
          name: "Other Public",
          public: true
        },
        {
          id: otherPrivateOrgId,
          slug: `org-${createId().slice(0, 8)}`,
          name: "Other Private",
          public: false
        }
      ]
    });

    await live.db.user.createMany({
      data: [
        {
          id: createId(),
          organizationId: ownedPrivateOrgId,
          accountId,
          kind: "HUMAN",
          firstName: "Owner",
          username: `owner-${createId().slice(0, 6)}`
        },
        {
          id: createId(),
          organizationId: ownedPublicOrgId,
          accountId,
          kind: "HUMAN",
          firstName: "Owner",
          username: `owner-${createId().slice(0, 6)}`
        },
        {
          id: createId(),
          organizationId: otherPrivateOrgId,
          accountId: otherAccountId,
          kind: "HUMAN",
          firstName: "Other",
          username: `other-${createId().slice(0, 6)}`
        }
      ]
    });

    const result = await organizationAvailableResolve(live.context, { accountId });
    const ids = new Set(result.map((item) => item.id));

    expect(ids).toEqual(new Set([ownedPrivateOrgId, ownedPublicOrgId, otherPublicOrgId]));
    expect(ids.has(otherPrivateOrgId)).toBe(false);
  });

  it("includes private orgs where account has a pending invite", async () => {
    const accountId = createId();
    const inviterAccountId = createId();
    const privateOrgId = createId();
    const inviterUserId = createId();
    const email = `invited-${createId().slice(0, 6)}@test.com`;

    await live.db.account.createMany({
      data: [
        { id: accountId, email },
        { id: inviterAccountId, email: `inviter-${createId().slice(0, 6)}@test.com` }
      ]
    });

    await live.db.organization.create({
      data: {
        id: privateOrgId,
        slug: `org-${createId().slice(0, 8)}`,
        name: "Invited Org",
        public: false
      }
    });

    await live.db.user.create({
      data: {
        id: inviterUserId,
        organizationId: privateOrgId,
        accountId: inviterAccountId,
        kind: "HUMAN",
        firstName: "Inviter",
        username: `inviter-${createId().slice(0, 6)}`,
        orgRole: "OWNER"
      }
    });

    // Create a valid invite
    await live.db.orgInvite.create({
      data: {
        id: createId(),
        organizationId: privateOrgId,
        invitedByUserId: inviterUserId,
        email,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });

    const result = await organizationAvailableResolve(live.context, { accountId });
    const ids = result.map((item) => item.id);
    expect(ids).toContain(privateOrgId);
  });

  it("excludes private orgs where invite is expired", async () => {
    const accountId = createId();
    const inviterAccountId = createId();
    const privateOrgId = createId();
    const inviterUserId = createId();
    const email = `invited-${createId().slice(0, 6)}@test.com`;

    await live.db.account.createMany({
      data: [
        { id: accountId, email },
        { id: inviterAccountId, email: `inviter-${createId().slice(0, 6)}@test.com` }
      ]
    });

    await live.db.organization.create({
      data: {
        id: privateOrgId,
        slug: `org-${createId().slice(0, 8)}`,
        name: "Expired Invite Org",
        public: false
      }
    });

    await live.db.user.create({
      data: {
        id: inviterUserId,
        organizationId: privateOrgId,
        accountId: inviterAccountId,
        kind: "HUMAN",
        firstName: "Inviter",
        username: `inviter-${createId().slice(0, 6)}`,
        orgRole: "OWNER"
      }
    });

    await live.db.orgInvite.create({
      data: {
        id: createId(),
        organizationId: privateOrgId,
        invitedByUserId: inviterUserId,
        email,
        expiresAt: new Date(Date.now() - 1000) // expired
      }
    });

    const result = await organizationAvailableResolve(live.context, { accountId });
    const ids = result.map((item) => item.id);
    expect(ids).not.toContain(privateOrgId);
  });

  it("excludes private orgs where invite is revoked", async () => {
    const accountId = createId();
    const inviterAccountId = createId();
    const privateOrgId = createId();
    const inviterUserId = createId();
    const email = `invited-${createId().slice(0, 6)}@test.com`;

    await live.db.account.createMany({
      data: [
        { id: accountId, email },
        { id: inviterAccountId, email: `inviter-${createId().slice(0, 6)}@test.com` }
      ]
    });

    await live.db.organization.create({
      data: {
        id: privateOrgId,
        slug: `org-${createId().slice(0, 8)}`,
        name: "Revoked Invite Org",
        public: false
      }
    });

    await live.db.user.create({
      data: {
        id: inviterUserId,
        organizationId: privateOrgId,
        accountId: inviterAccountId,
        kind: "HUMAN",
        firstName: "Inviter",
        username: `inviter-${createId().slice(0, 6)}`,
        orgRole: "OWNER"
      }
    });

    await live.db.orgInvite.create({
      data: {
        id: createId(),
        organizationId: privateOrgId,
        invitedByUserId: inviterUserId,
        email,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        revokedAt: new Date()
      }
    });

    const result = await organizationAvailableResolve(live.context, { accountId });
    const ids = result.map((item) => item.id);
    expect(ids).not.toContain(privateOrgId);
  });

  it("includes private orgs where account email domain matches an OrgDomain", async () => {
    const accountId = createId();
    const ownerAccountId = createId();
    const privateOrgId = createId();
    const ownerUserId = createId();

    await live.db.account.createMany({
      data: [
        { id: accountId, email: `user-${createId().slice(0, 6)}@matching-domain.com` },
        { id: ownerAccountId, email: `owner-${createId().slice(0, 6)}@other.com` }
      ]
    });

    await live.db.organization.create({
      data: {
        id: privateOrgId,
        slug: `org-${createId().slice(0, 8)}`,
        name: "Domain Org",
        public: false
      }
    });

    await live.db.user.create({
      data: {
        id: ownerUserId,
        organizationId: privateOrgId,
        accountId: ownerAccountId,
        kind: "HUMAN",
        firstName: "Owner",
        username: `owner-${createId().slice(0, 6)}`,
        orgRole: "OWNER"
      }
    });

    await live.db.orgDomain.create({
      data: {
        id: createId(),
        organizationId: privateOrgId,
        createdByUserId: ownerUserId,
        domain: "matching-domain.com"
      }
    });

    const result = await organizationAvailableResolve(live.context, { accountId });
    const ids = result.map((item) => item.id);
    expect(ids).toContain(privateOrgId);
  });

  it("excludes private orgs where email domain does not match", async () => {
    const accountId = createId();
    const ownerAccountId = createId();
    const privateOrgId = createId();
    const ownerUserId = createId();

    await live.db.account.createMany({
      data: [
        { id: accountId, email: `user-${createId().slice(0, 6)}@no-match.com` },
        { id: ownerAccountId, email: `owner-${createId().slice(0, 6)}@other.com` }
      ]
    });

    await live.db.organization.create({
      data: {
        id: privateOrgId,
        slug: `org-${createId().slice(0, 8)}`,
        name: "Domain Org",
        public: false
      }
    });

    await live.db.user.create({
      data: {
        id: ownerUserId,
        organizationId: privateOrgId,
        accountId: ownerAccountId,
        kind: "HUMAN",
        firstName: "Owner",
        username: `owner-${createId().slice(0, 6)}`,
        orgRole: "OWNER"
      }
    });

    await live.db.orgDomain.create({
      data: {
        id: createId(),
        organizationId: privateOrgId,
        createdByUserId: ownerUserId,
        domain: "allowed-domain.com"
      }
    });

    const result = await organizationAvailableResolve(live.context, { accountId });
    const ids = result.map((item) => item.id);
    expect(ids).not.toContain(privateOrgId);
  });
});
