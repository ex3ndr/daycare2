import { createId } from "@paralleldrive/cuid2";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@/apps/api/lib/apiError.js";
import { testLiveContextCreate } from "@/utils/testLiveContextCreate.js";
import { directCreate } from "./directCreate.js";

type LiveContext = Awaited<ReturnType<typeof testLiveContextCreate>>;

describe("directCreate", () => {
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
    const userAId = createId();
    const userBId = createId();

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
          id: userAId,
          organizationId: orgId,
          kind: "HUMAN",
          firstName: "Alice",
          username: `alice-${createId().slice(0, 6)}`
        },
        {
          id: userBId,
          organizationId: orgId,
          kind: "HUMAN",
          firstName: "Bob",
          username: `bob-${createId().slice(0, 6)}`
        }
      ]
    });

    return { orgId, userAId, userBId };
  }

  it("creates a direct chat and adds both members", async () => {
    const { orgId, userAId, userBId } = await seedUsers();

    const chat = await directCreate(live.context, {
      organizationId: orgId,
      userId: userAId,
      peerUserId: userBId
    });

    expect(chat.kind).toBe("DIRECT");
    expect(chat.directKey).toBe([userAId, userBId].sort().join(":"));

    const memberships = await live.db.chatMember.findMany({
      where: {
        chatId: chat.id,
        leftAt: null
      }
    });
    expect(memberships).toHaveLength(2);

    const updates = await live.db.userUpdate.findMany({
      orderBy: { seqno: "asc" }
    });
    expect(updates).toHaveLength(2);
    expect(new Set(updates.map((update) => update.userId))).toEqual(new Set([userAId, userBId]));
    expect(new Set(updates.map((update) => update.eventType))).toEqual(new Set(["channel.created"]));
  });

  it("returns existing direct and reactivates left member", async () => {
    const { orgId, userAId, userBId } = await seedUsers();

    const initial = await directCreate(live.context, {
      organizationId: orgId,
      userId: userAId,
      peerUserId: userBId
    });

    await live.db.chatMember.update({
      where: {
        chatId_userId: {
          chatId: initial.id,
          userId: userBId
        }
      },
      data: {
        leftAt: new Date("2026-02-10T00:00:00.000Z")
      }
    });

    const reopened = await directCreate(live.context, {
      organizationId: orgId,
      userId: userBId,
      peerUserId: userAId
    });

    expect(reopened.id).toBe(initial.id);

    const member = await live.db.chatMember.findUnique({
      where: {
        chatId_userId: {
          chatId: initial.id,
          userId: userBId
        }
      }
    });
    expect(member?.leftAt).toBeNull();
  });

  it("rejects self direct chats", async () => {
    const { orgId, userAId } = await seedUsers();

    await expect(directCreate(live.context, {
      organizationId: orgId,
      userId: userAId,
      peerUserId: userAId
    })).rejects.toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR"
    } satisfies Partial<ApiError>);
  });
});
