import { createId } from "@paralleldrive/cuid2";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testLiveContextCreate } from "@/utils/testLiveContextCreate.js";
import { orgDomainAdd } from "./orgDomainAdd.js";
import { orgDomainRemove } from "./orgDomainRemove.js";

type LiveContext = Awaited<ReturnType<typeof testLiveContextCreate>>;

describe("orgDomainRemove", () => {
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
        }
      ]
    });

    return { orgId, ownerId, memberId };
  }

  it("removes a domain successfully", async () => {
    const { orgId, ownerId } = await seedOrg();

    const domain = await orgDomainAdd(live.context, {
      organizationId: orgId,
      actorUserId: ownerId,
      domain: "company.com"
    });

    await orgDomainRemove(live.context, {
      organizationId: orgId,
      actorUserId: ownerId,
      domainId: domain.id
    });

    // Verify domain is deleted
    const remaining = await live.db.orgDomain.findMany({
      where: { organizationId: orgId }
    });
    expect(remaining).toHaveLength(0);

    // Verify SSE event was published
    const updates = await live.db.userUpdate.findMany({
      where: { eventType: "organization.domain.removed" }
    });
    expect(updates.length).toBeGreaterThan(0);
  });

  it("rejects when domain not found", async () => {
    const { orgId, ownerId } = await seedOrg();

    await expect(orgDomainRemove(live.context, {
      organizationId: orgId,
      actorUserId: ownerId,
      domainId: createId()
    })).rejects.toMatchObject({ statusCode: 404 });
  });

  it("rejects when actor is not an owner", async () => {
    const { orgId, ownerId, memberId } = await seedOrg();

    const domain = await orgDomainAdd(live.context, {
      organizationId: orgId,
      actorUserId: ownerId,
      domain: "company.com"
    });

    await expect(orgDomainRemove(live.context, {
      organizationId: orgId,
      actorUserId: memberId,
      domainId: domain.id
    })).rejects.toMatchObject({ statusCode: 403 });
  });
});
