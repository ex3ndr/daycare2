import { createId } from "@paralleldrive/cuid2";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testLiveContextCreate } from "@/utils/testLiveContextCreate.js";
import { messageSearch } from "./messageSearch.js";

type LiveContext = Awaited<ReturnType<typeof testLiveContextCreate>>;

describe("messageSearch", () => {
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

  async function seedBase() {
    const orgId = createId();
    const userId = createId();
    const otherId = createId();
    const channelId = createId();

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
          id: userId,
          organizationId: orgId,
          kind: "HUMAN",
          firstName: "Alice",
          username: `alice-${createId().slice(0, 6)}`
        },
        {
          id: otherId,
          organizationId: orgId,
          kind: "HUMAN",
          firstName: "Bob",
          username: `bob-${createId().slice(0, 6)}`
        }
      ]
    });

    await live.db.chat.create({
      data: {
        id: channelId,
        organizationId: orgId,
        createdByUserId: userId,
        kind: "CHANNEL",
        visibility: "PUBLIC",
        name: "general"
      }
    });

    await live.db.chatMember.createMany({
      data: [
        {
          id: createId(),
          chatId: channelId,
          userId,
          role: "OWNER",
          notificationLevel: "ALL"
        },
        {
          id: createId(),
          chatId: channelId,
          userId: otherId,
          role: "MEMBER",
          notificationLevel: "ALL"
        }
      ]
    });

    return { orgId, userId, otherId, channelId };
  }

  it("returns ranked message search results", async () => {
    const { orgId, userId, channelId } = await seedBase();

    const message = await live.db.message.create({
      data: {
        id: createId(),
        chatId: channelId,
        senderUserId: userId,
        text: "alphakeyword daycare"
      }
    });

    const result = await messageSearch(live.context, {
      organizationId: orgId,
      userId,
      query: "alphakeyword"
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(message.id);
    expect(result[0]?.text).toContain("alphakeyword");
  });

  it("supports channel filters and before pagination", async () => {
    const { orgId, userId, channelId } = await seedBase();

    const earlier = new Date("2026-02-10T00:00:00.000Z");
    const later = new Date("2026-02-11T00:00:00.000Z");

    await live.db.message.create({
      data: {
        id: createId(),
        chatId: channelId,
        senderUserId: userId,
        text: "betakeyword earlier",
        createdAt: earlier
      }
    });

    await live.db.message.create({
      data: {
        id: createId(),
        chatId: channelId,
        senderUserId: userId,
        text: "betakeyword later",
        createdAt: later
      }
    });

    const result = await messageSearch(live.context, {
      organizationId: orgId,
      userId,
      query: "betakeyword",
      channelId,
      before: later.getTime(),
      limit: 10
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.text).toContain("earlier");
  });

  it("returns empty results when no matches exist", async () => {
    const { orgId, userId } = await seedBase();

    const result = await messageSearch(live.context, {
      organizationId: orgId,
      userId,
      query: "missingkeyword"
    });

    expect(result).toEqual([]);
  });

  it("handles search terms with special characters", async () => {
    const { orgId, userId, channelId } = await seedBase();

    await live.db.message.create({
      data: {
        id: createId(),
        chatId: channelId,
        senderUserId: userId,
        text: "alice ops"
      }
    });

    const result = await messageSearch(live.context, {
      organizationId: orgId,
      userId,
      query: "@alice + #ops"
    });

    expect(Array.isArray(result)).toBe(true);
  });
});
