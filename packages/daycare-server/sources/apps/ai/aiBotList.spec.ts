import { createId } from "@paralleldrive/cuid2";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testLiveContextCreate } from "@/utils/testLiveContextCreate.js";
import { aiBotList } from "./aiBotList.js";

type LiveContext = Awaited<ReturnType<typeof testLiveContextCreate>>;

describe("aiBotList", () => {
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

  it("lists AI users in an organization", async () => {
    const orgId = createId();

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
          id: createId(),
          organizationId: orgId,
          kind: "AI",
          firstName: "Assistant",
          username: "assistant"
        },
        {
          id: createId(),
          organizationId: orgId,
          kind: "HUMAN",
          firstName: "Human",
          username: "human"
        }
      ]
    });

    const bots = await aiBotList(live.context, {
      organizationId: orgId
    });

    expect(bots).toHaveLength(1);
    expect(bots[0]?.username).toBe("assistant");
  });
});
