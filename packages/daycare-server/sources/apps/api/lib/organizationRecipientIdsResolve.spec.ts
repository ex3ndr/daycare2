import { createId } from "@paralleldrive/cuid2";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testLiveContextCreate } from "@/utils/testLiveContextCreate.js";
import { organizationRecipientIdsResolve } from "./organizationRecipientIdsResolve.js";

type LiveContext = Awaited<ReturnType<typeof testLiveContextCreate>>;

describe("organizationRecipientIdsResolve", () => {
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

  it("returns all user ids in the organization", async () => {
    const orgId = createId();
    const userAId = createId();
    const userBId = createId();
    const otherOrgId = createId();

    await live.db.organization.createMany({
      data: [
        {
          id: orgId,
          slug: `org-${createId().slice(0, 8)}`,
          name: "Acme"
        },
        {
          id: otherOrgId,
          slug: `org-${createId().slice(0, 8)}`,
          name: "Other"
        }
      ]
    });

    await live.db.user.createMany({
      data: [
        {
          id: userAId,
          organizationId: orgId,
          kind: "HUMAN",
          firstName: "A",
          username: `a-${createId().slice(0, 6)}`
        },
        {
          id: userBId,
          organizationId: orgId,
          kind: "HUMAN",
          firstName: "B",
          username: `b-${createId().slice(0, 6)}`
        },
        {
          id: createId(),
          organizationId: otherOrgId,
          kind: "HUMAN",
          firstName: "C",
          username: `c-${createId().slice(0, 6)}`
        }
      ]
    });

    const result = await organizationRecipientIdsResolve(live.context, orgId);

    expect(new Set(result)).toEqual(new Set([userAId, userBId]));
  });
});
