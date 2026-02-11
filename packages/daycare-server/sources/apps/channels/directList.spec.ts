import { createId } from "@paralleldrive/cuid2";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testLiveContextCreate } from "@/utils/testLiveContextCreate.js";
import { directList } from "./directList.js";

type LiveContext = Awaited<ReturnType<typeof testLiveContextCreate>>;

describe("directList", () => {
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
    const user3Id = createId();

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
        },
        {
          id: user3Id,
          organizationId: orgId,
          kind: "HUMAN",
          firstName: "Carol",
          username: `carol-${createId().slice(0, 6)}`
        }
      ]
    });

    return { orgId, user1Id, user2Id, user3Id };
  }

  async function directCreateWithMembers(orgId: string, userIdA: string, userIdB: string, leftUserId?: string) {
    const chatId = createId();
    await live.db.chat.create({
      data: {
        id: chatId,
        organizationId: orgId,
        createdByUserId: userIdA,
        kind: "DIRECT",
        visibility: "PRIVATE",
        directKey: [userIdA, userIdB].sort().join(":")
      }
    });

    await live.db.chatMember.createMany({
      data: [
        {
          id: createId(),
          chatId,
          userId: userIdA,
          role: "MEMBER",
          notificationLevel: "ALL"
        },
        {
          id: createId(),
          chatId,
          userId: userIdB,
          role: "MEMBER",
          notificationLevel: "ALL",
          leftAt: leftUserId === userIdB ? new Date("2026-02-11T00:00:00.000Z") : null
        }
      ]
    });

    return chatId;
  }

  it("returns an empty list when user has no directs", async () => {
    const { orgId, user1Id } = await seedUsers();

    const directs = await directList(live.context, {
      organizationId: orgId,
      userId: user1Id
    });

    expect(directs).toEqual([]);
  });

  it("returns direct chats with other user details", async () => {
    const { orgId, user1Id, user2Id, user3Id } = await seedUsers();

    await directCreateWithMembers(orgId, user1Id, user2Id);
    await directCreateWithMembers(orgId, user1Id, user3Id);

    const directs = await directList(live.context, {
      organizationId: orgId,
      userId: user1Id
    });

    expect(directs).toHaveLength(2);

    const otherUserIds = directs.map((direct) => direct.otherUser.id);
    expect(new Set(otherUserIds)).toEqual(new Set([user2Id, user3Id]));
  });

  it("excludes directs without an active peer member", async () => {
    const { orgId, user1Id, user2Id } = await seedUsers();

    await directCreateWithMembers(orgId, user1Id, user2Id, user2Id);

    const directs = await directList(live.context, {
      organizationId: orgId,
      userId: user1Id
    });

    expect(directs).toEqual([]);
  });
});
