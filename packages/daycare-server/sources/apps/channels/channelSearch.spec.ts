import { createId } from "@paralleldrive/cuid2";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testLiveContextCreate } from "@/utils/testLiveContextCreate.js";
import { channelSearch } from "./channelSearch.js";

type LiveContext = Awaited<ReturnType<typeof testLiveContextCreate>>;

describe("channelSearch", () => {
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

  async function seedChannels() {
    const orgId = createId();
    const userId = createId();
    const otherId = createId();
    const publicChannelId = createId();
    const privateChannelId = createId();

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

    await live.db.chat.createMany({
      data: [
        {
          id: publicChannelId,
          organizationId: orgId,
          createdByUserId: userId,
          kind: "CHANNEL",
          visibility: "PUBLIC",
          name: "general",
          topic: "company wide"
        },
        {
          id: privateChannelId,
          organizationId: orgId,
          createdByUserId: otherId,
          kind: "CHANNEL",
          visibility: "PRIVATE",
          name: "engineering",
          topic: "oncall operations"
        }
      ]
    });

    await live.db.chatMember.create({
      data: {
        id: createId(),
        chatId: privateChannelId,
        userId,
        role: "MEMBER",
        notificationLevel: "ALL"
      }
    });

    return { orgId, userId, publicChannelId, privateChannelId };
  }

  it("returns channels matching by name", async () => {
    const { orgId, userId, publicChannelId } = await seedChannels();

    const result = await channelSearch(live.context, {
      organizationId: orgId,
      userId,
      query: "general"
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(publicChannelId);
    expect(result[0]?.name).toBe("general");
  });

  it("returns private channels matching by topic for members", async () => {
    const { orgId, userId, privateChannelId } = await seedChannels();

    const result = await channelSearch(live.context, {
      organizationId: orgId,
      userId,
      query: "oncall",
      limit: 5
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(privateChannelId);
    expect(result[0]?.topic).toContain("oncall");
    expect(result[0]?.visibility).toBe("private");
  });

  it("returns empty array when no matches exist", async () => {
    const { orgId, userId } = await seedChannels();

    const result = await channelSearch(live.context, {
      organizationId: orgId,
      userId,
      query: "missing"
    });

    expect(result).toEqual([]);
  });
});
