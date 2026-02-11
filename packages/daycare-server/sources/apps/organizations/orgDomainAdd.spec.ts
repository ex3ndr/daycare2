import { createId } from "@paralleldrive/cuid2";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testLiveContextCreate } from "@/utils/testLiveContextCreate.js";
import { orgDomainAdd } from "./orgDomainAdd.js";

type LiveContext = Awaited<ReturnType<typeof testLiveContextCreate>>;

describe("orgDomainAdd", () => {
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

  it("adds a domain successfully", async () => {
    const { orgId, ownerId } = await seedOrg();

    const domain = await orgDomainAdd(live.context, {
      organizationId: orgId,
      actorUserId: ownerId,
      domain: "company.com"
    });

    expect(domain.organizationId).toBe(orgId);
    expect(domain.createdByUserId).toBe(ownerId);
    expect(domain.domain).toBe("company.com");

    // Verify SSE event was published
    const updates = await live.db.userUpdate.findMany({
      where: { eventType: "organization.domain.added" }
    });
    expect(updates.length).toBeGreaterThan(0);
  });

  it("normalizes domain to lowercase and strips leading @", async () => {
    const { orgId, ownerId } = await seedOrg();

    const domain = await orgDomainAdd(live.context, {
      organizationId: orgId,
      actorUserId: ownerId,
      domain: "@Company.COM"
    });

    expect(domain.domain).toBe("company.com");
  });

  it("rejects duplicate domain for same org", async () => {
    const { orgId, ownerId } = await seedOrg();

    await orgDomainAdd(live.context, {
      organizationId: orgId,
      actorUserId: ownerId,
      domain: "company.com"
    });

    await expect(orgDomainAdd(live.context, {
      organizationId: orgId,
      actorUserId: ownerId,
      domain: "company.com"
    })).rejects.toMatchObject({ statusCode: 409 });
  });

  it("rejects invalid domain format", async () => {
    const { orgId, ownerId } = await seedOrg();

    await expect(orgDomainAdd(live.context, {
      organizationId: orgId,
      actorUserId: ownerId,
      domain: "not-a-domain"
    })).rejects.toMatchObject({ statusCode: 400 });

    await expect(orgDomainAdd(live.context, {
      organizationId: orgId,
      actorUserId: ownerId,
      domain: ""
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects when actor is not an owner", async () => {
    const { orgId, memberId } = await seedOrg();

    await expect(orgDomainAdd(live.context, {
      organizationId: orgId,
      actorUserId: memberId,
      domain: "company.com"
    })).rejects.toMatchObject({ statusCode: 403 });
  });
});
