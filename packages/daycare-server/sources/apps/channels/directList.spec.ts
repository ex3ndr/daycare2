import { describe, expect, it, vi } from "vitest";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { directList } from "./directList.js";

describe("directList", () => {
  it("returns an empty list when user has no directs", async () => {
    const context = {
      db: {
        chatMember: {
          findMany: vi.fn().mockResolvedValue([])
        }
      }
    } as unknown as ApiContext;

    const directs = await directList(context, {
      organizationId: "org-1",
      userId: "user-1"
    });

    expect(directs).toEqual([]);
  });

  it("returns multiple directs with other user details", async () => {
    const context = {
      db: {
        chatMember: {
          findMany: vi.fn().mockResolvedValue([
            {
              chat: {
                id: "chat-1",
                organizationId: "org-1",
                createdByUserId: "user-1",
                kind: "DIRECT",
                visibility: "PRIVATE",
                directKey: "user-1:user-2",
                name: null,
                topic: null,
                createdAt: new Date("2026-02-11T00:00:00.000Z"),
                updatedAt: new Date("2026-02-11T00:00:00.000Z"),
                archivedAt: null,
                members: [{
                  user: {
                    id: "user-2",
                    organizationId: "org-1",
                    accountId: "account-2",
                    kind: "HUMAN",
                    username: "bob",
                    firstName: "Bob",
                    lastName: null,
                    bio: null,
                    timezone: null,
                    avatarUrl: null,
                    systemPrompt: null,
                    createdAt: new Date("2026-02-11T00:00:00.000Z"),
                    updatedAt: new Date("2026-02-11T00:00:00.000Z"),
                    lastSeenAt: null
                  }
                }]
              }
            },
            {
              chat: {
                id: "chat-2",
                organizationId: "org-1",
                createdByUserId: "user-1",
                kind: "DIRECT",
                visibility: "PRIVATE",
                directKey: "user-1:user-3",
                name: null,
                topic: null,
                createdAt: new Date("2026-02-11T00:00:00.000Z"),
                updatedAt: new Date("2026-02-11T00:00:00.000Z"),
                archivedAt: null,
                members: [{
                  user: {
                    id: "user-3",
                    organizationId: "org-1",
                    accountId: "account-3",
                    kind: "HUMAN",
                    username: "carol",
                    firstName: "Carol",
                    lastName: "A",
                    bio: null,
                    timezone: null,
                    avatarUrl: "https://example.com/avatar.png",
                    systemPrompt: null,
                    createdAt: new Date("2026-02-11T00:00:00.000Z"),
                    updatedAt: new Date("2026-02-11T00:00:00.000Z"),
                    lastSeenAt: null
                  }
                }]
              }
            }
          ])
        }
      }
    } as unknown as ApiContext;

    const directs = await directList(context, {
      organizationId: "org-1",
      userId: "user-1"
    });

    expect(directs).toHaveLength(2);
    expect(directs[0]?.chat.id).toBe("chat-1");
    expect(directs[0]?.otherUser.username).toBe("bob");
    expect(directs[1]?.chat.id).toBe("chat-2");
    expect(directs[1]?.otherUser.username).toBe("carol");
  });

  it("excludes direct chats without an active peer member", async () => {
    const context = {
      db: {
        chatMember: {
          findMany: vi.fn().mockResolvedValue([
            {
              chat: {
                id: "chat-1",
                organizationId: "org-1",
                createdByUserId: "user-1",
                kind: "DIRECT",
                visibility: "PRIVATE",
                directKey: "user-1:user-2",
                name: null,
                topic: null,
                createdAt: new Date("2026-02-11T00:00:00.000Z"),
                updatedAt: new Date("2026-02-11T00:00:00.000Z"),
                archivedAt: null,
                members: []
              }
            }
          ])
        }
      }
    } as unknown as ApiContext;

    const directs = await directList(context, {
      organizationId: "org-1",
      userId: "user-1"
    });

    expect(directs).toEqual([]);
  });
});
