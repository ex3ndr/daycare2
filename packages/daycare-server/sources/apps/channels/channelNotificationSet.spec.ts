import { createId } from "@paralleldrive/cuid2";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testLiveContextCreate } from "@/utils/testLiveContextCreate.js";
import { channelNotificationSet } from "./channelNotificationSet.js";

type LiveContext = Awaited<ReturnType<typeof testLiveContextCreate>>;

describe("channelNotificationSet", () => {
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

  async function seedMembership() {
    const orgId = createId();
    const userId = createId();
    const channelId = createId();

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
        firstName: "User",
        username: `user-${createId().slice(0, 6)}`
      }
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

    await live.db.chatMember.create({
      data: {
        id: createId(),
        chatId: channelId,
        userId,
        role: "OWNER",
        notificationLevel: "ALL"
      }
    });

    return { orgId, channelId, userId };
  }

  it("sets notification level ALL and clears mute state", async () => {
    const { orgId, channelId, userId } = await seedMembership();

    const membership = await channelNotificationSet(live.context, {
      organizationId: orgId,
      channelId,
      userId,
      level: "ALL"
    });

    expect(membership.notificationLevel).toBe("ALL");
    expect(membership.muteForever).toBe(false);
    expect(membership.muteUntil).toBeNull();
  });

  it("sets MENTIONS_ONLY and clears mute state", async () => {
    const { orgId, channelId, userId } = await seedMembership();

    const membership = await channelNotificationSet(live.context, {
      organizationId: orgId,
      channelId,
      userId,
      level: "MENTIONS_ONLY"
    });

    expect(membership.notificationLevel).toBe("MENTIONS_ONLY");
    expect(membership.muteForever).toBe(false);
    expect(membership.muteUntil).toBeNull();
  });

  it("sets MUTED with muteUntil", async () => {
    const { orgId, channelId, userId } = await seedMembership();
    const muteUntil = Date.now() + 60_000;

    const membership = await channelNotificationSet(live.context, {
      organizationId: orgId,
      channelId,
      userId,
      level: "MUTED",
      muteUntil
    });

    expect(membership.notificationLevel).toBe("MUTED");
    expect(membership.muteForever).toBe(false);
    expect(membership.muteUntil?.getTime()).toBeGreaterThan(Date.now());
  });

  it("sets MUTED forever when muteUntil is omitted", async () => {
    const { orgId, channelId, userId } = await seedMembership();

    const membership = await channelNotificationSet(live.context, {
      organizationId: orgId,
      channelId,
      userId,
      level: "MUTED"
    });

    expect(membership.notificationLevel).toBe("MUTED");
    expect(membership.muteForever).toBe(true);
    expect(membership.muteUntil).toBeNull();
  });

  it("rejects MUTED with past muteUntil", async () => {
    const { orgId, channelId, userId } = await seedMembership();

    await expect(channelNotificationSet(live.context, {
      organizationId: orgId,
      channelId,
      userId,
      level: "MUTED",
      muteUntil: Date.now() - 1_000
    })).rejects.toMatchObject({ statusCode: 400 });
  });
});
