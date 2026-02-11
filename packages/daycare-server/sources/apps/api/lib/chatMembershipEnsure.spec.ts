import { createId } from "@paralleldrive/cuid2";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testLiveContextCreate } from "@/utils/testLiveContextCreate.js";
import { ApiError } from "./apiError.js";
import { chatMembershipEnsure } from "./chatMembershipEnsure.js";

type LiveContext = Awaited<ReturnType<typeof testLiveContextCreate>>;

describe("chatMembershipEnsure", () => {
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

  async function seedMembership(leftAt: Date | null = null) {
    const orgId = createId();
    const userId = createId();
    const chatId = createId();

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
        id: chatId,
        organizationId: orgId,
        createdByUserId: userId,
        kind: "CHANNEL",
        visibility: "PUBLIC",
        name: "general"
      }
    });

    const membership = await live.db.chatMember.create({
      data: {
        id: createId(),
        chatId,
        userId,
        role: "OWNER",
        notificationLevel: "ALL",
        leftAt
      }
    });

    return { userId, chatId, membership };
  }

  it("returns membership when user belongs to chat", async () => {
    const { userId, chatId, membership } = await seedMembership();

    await expect(chatMembershipEnsure(live.context, chatId, userId)).resolves.toMatchObject({
      id: membership.id,
      chatId,
      userId
    });
  });

  it("throws forbidden when membership is absent", async () => {
    const { userId, chatId } = await seedMembership(new Date("2026-02-11T00:00:00.000Z"));

    const promise = chatMembershipEnsure(live.context, chatId, userId);
    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await expect(promise).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN"
    });
  });
});
