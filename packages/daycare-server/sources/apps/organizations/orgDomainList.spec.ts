import { createId } from "@paralleldrive/cuid2";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testLiveContextCreate } from "@/utils/testLiveContextCreate.js";
import { orgDomainAdd } from "./orgDomainAdd.js";
import { orgDomainList } from "./orgDomainList.js";

type LiveContext = Awaited<ReturnType<typeof testLiveContextCreate>>;

describe("orgDomainList", () => {
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

  it("returns empty list when no domains exist", async () => {
    const { orgId, ownerId } = await seedOrg();

    const domains = await orgDomainList(live.context, {
      organizationId: orgId,
      actorUserId: ownerId
    });

    expect(domains).toEqual([]);
  });

  it("returns all domains for the org", async () => {
    const { orgId, ownerId } = await seedOrg();

    await orgDomainAdd(live.context, {
      organizationId: orgId,
      actorUserId: ownerId,
      domain: "company.com"
    });

    await orgDomainAdd(live.context, {
      organizationId: orgId,
      actorUserId: ownerId,
      domain: "another.org"
    });

    const domains = await orgDomainList(live.context, {
      organizationId: orgId,
      actorUserId: ownerId
    });

    expect(domains).toHaveLength(2);
    const domainNames = domains.map((d) => d.domain);
    expect(domainNames).toContain("company.com");
    expect(domainNames).toContain("another.org");
  });

  it("allows regular members to list domains", async () => {
    const { orgId, ownerId, memberId } = await seedOrg();

    await orgDomainAdd(live.context, {
      organizationId: orgId,
      actorUserId: ownerId,
      domain: "company.com"
    });

    const domains = await orgDomainList(live.context, {
      organizationId: orgId,
      actorUserId: memberId
    });

    expect(domains).toHaveLength(1);
    expect(domains[0]!.domain).toBe("company.com");
  });

  it("rejects non-members", async () => {
    const { orgId } = await seedOrg();

    await expect(orgDomainList(live.context, {
      organizationId: orgId,
      actorUserId: createId()
    })).rejects.toMatchObject({ statusCode: 403 });
  });
});
