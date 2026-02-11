import { createId } from "@paralleldrive/cuid2";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testLiveContextCreate } from "@/utils/testLiveContextCreate.js";
import { presenceGet } from "./presenceGet.js";

type LiveContext = Awaited<ReturnType<typeof testLiveContextCreate>>;

describe("presenceGet", () => {
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

  it("returns offline for missing users and status for active users", async () => {
    const orgId = createId();
    const user1Id = createId();
    const user2Id = createId();
    const user3Id = createId();

    await live.redis.set(`presence:${orgId}:${user1Id}`, "online", "EX", 90);
    await live.redis.set(`presence:${orgId}:${user3Id}`, "away", "EX", 90);

    const result = await presenceGet(live.context, {
      organizationId: orgId,
      userIds: [user1Id, user2Id, user3Id]
    });

    expect(result).toEqual([
      { userId: user1Id, status: "online" },
      { userId: user2Id, status: "offline" },
      { userId: user3Id, status: "away" }
    ]);
  });

  it("returns empty result when no users are requested", async () => {
    const result = await presenceGet(live.context, {
      organizationId: createId(),
      userIds: []
    });

    expect(result).toEqual([]);
  });
});
