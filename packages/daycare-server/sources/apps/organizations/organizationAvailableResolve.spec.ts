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
});
