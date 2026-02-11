import { createId } from "@paralleldrive/cuid2";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testLiveContextCreate } from "@/utils/testLiveContextCreate.js";
import { chatRecipientIdsResolve } from "./chatRecipientIdsResolve.js";

type LiveContext = Awaited<ReturnType<typeof testLiveContextCreate>>;

describe("chatRecipientIdsResolve", () => {
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

  it("returns user ids for active chat members", async () => {
    const orgId = createId();
    const chatId = createId();
    const activeUserId = createId();
    const leftUserId = createId();

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
          id: activeUserId,
          organizationId: orgId,
          kind: "HUMAN",
          firstName: "Active",
          username: `active-${createId().slice(0, 6)}`
        },
        {
          id: leftUserId,
          organizationId: orgId,
          kind: "HUMAN",
          firstName: "Left",
          username: `left-${createId().slice(0, 6)}`
        }
      ]
    });

    await live.db.chat.create({
      data: {
        id: chatId,
        organizationId: orgId,
        createdByUserId: activeUserId,
        kind: "CHANNEL",
        visibility: "PUBLIC",
        name: "general"
      }
    });

    await live.db.chatMember.createMany({
      data: [
        {
          id: createId(),
          chatId,
          userId: activeUserId,
          role: "OWNER",
          notificationLevel: "ALL"
        },
        {
          id: createId(),
          chatId,
          userId: leftUserId,
          role: "MEMBER",
          notificationLevel: "ALL",
          leftAt: new Date("2026-02-11T00:00:00.000Z")
        }
      ]
    });

    const result = await chatRecipientIdsResolve(live.context, chatId);

    expect(result).toEqual([activeUserId]);
  });
});
