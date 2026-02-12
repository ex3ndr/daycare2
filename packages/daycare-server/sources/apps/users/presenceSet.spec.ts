import { createId } from "@paralleldrive/cuid2";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testLiveContextCreate } from "@/utils/testLiveContextCreate.js";
import { presenceSet } from "./presenceSet.js";

type LiveContext = Awaited<ReturnType<typeof testLiveContextCreate>>;

describe("presenceSet", () => {
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

  async function seedUsers() {
    const orgId = createId();
    const user1Id = createId();
    const user2Id = createId();

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
          id: user1Id,
          organizationId: orgId,
          kind: "HUMAN",
          firstName: "Alice",
          username: `alice-${createId().slice(0, 6)}`
        },
        {
          id: user2Id,
          organizationId: orgId,
          kind: "HUMAN",
          firstName: "Bob",
          username: `bob-${createId().slice(0, 6)}`
        }
      ]
    });

    return { orgId, user1Id, user2Id };
  }

  it("sets online presence with ttl and publishes event", async () => {
    const { orgId, user1Id } = await seedUsers();

    const status = await presenceSet(live.context, {
      organizationId: orgId,
      userId: user1Id,
      status: "online"
    });

    expect(status).toBe("online");

    const key = `presence:${orgId}:${user1Id}`;
    const redisValue = await live.redis.get(key);
    expect(redisValue).toBe("online");

    const updates = await live.db.userUpdate.findMany({ orderBy: { userId: "asc" } });
    expect(updates).toHaveLength(0);
  });

  it("sets away presence with ttl", async () => {
    const { orgId, user1Id } = await seedUsers();

    const status = await presenceSet(live.context, {
      organizationId: orgId,
      userId: user1Id,
      status: "away"
    });

    expect(status).toBe("away");

    const key = `presence:${orgId}:${user1Id}`;
    const redisValue = await live.redis.get(key);
    expect(redisValue).toBe("away");
  });
});
