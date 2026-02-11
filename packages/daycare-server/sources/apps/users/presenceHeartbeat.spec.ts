import { createId } from "@paralleldrive/cuid2";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testLiveContextCreate } from "@/utils/testLiveContextCreate.js";
import { presenceHeartbeat } from "./presenceHeartbeat.js";

type LiveContext = Awaited<ReturnType<typeof testLiveContextCreate>>;

describe("presenceHeartbeat", () => {
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

  async function seedUser() {
    const orgId = createId();
    const userId = createId();

    await live.db.organization.create({
      data: {
        id: orgId,
        slug: `org-${createId().slice(0, 8)}`,
        name: "Acme"
      }
    });

    await live.db.user.create({
      data: {
        id: userId,
        organizationId: orgId,
        kind: "HUMAN",
        firstName: "Alice",
        username: `alice-${createId().slice(0, 6)}`
      }
    });

    return { orgId, userId };
  }

  it("refreshes ttl for existing online presence", async () => {
    const { orgId, userId } = await seedUser();
    const key = `presence:${orgId}:${userId}`;

    await live.redis.set(key, "online", "EX", 5);

    const status = await presenceHeartbeat(live.context, {
      organizationId: orgId,
      userId
    });

    expect(status).toBe("online");

    const ttl = await live.redis.ttl(key);
    expect(ttl).toBeGreaterThan(5);

    const user = await live.db.user.findUnique({ where: { id: userId } });
    expect(user?.lastSeenAt).not.toBeNull();
  });

  it("returns offline when no active presence key exists", async () => {
    const { orgId, userId } = await seedUser();

    const status = await presenceHeartbeat(live.context, {
      organizationId: orgId,
      userId
    });

    expect(status).toBe("offline");

    const key = `presence:${orgId}:${userId}`;
    const redisValue = await live.redis.get(key);
    expect(redisValue).toBeNull();
  });
});
