import { describe, it, expect, beforeEach } from "vitest";
import { syncEngine, SyncEngine } from "@slopus/sync";
import { schema, Schema } from "./schema";
import {
  channelsForCurrentOrg,
  messagesForChannel,
  threadMessagesForRoot,
  unreadCountForChannel,
  typingUsersForChannel,
  presenceForUser,
} from "./selectors";

function createEngine() {
  return syncEngine(schema, {
    from: "new",
    objects: {
      context: {
        userId: "user-1",
        orgId: "org-1",
        orgSlug: "test-org",
        orgName: "Test Org",
      },
    },
  });
}

describe("selectors", () => {
  let engine: SyncEngine<Schema>;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("channelsForCurrentOrg", () => {
    it("returns empty array when no channels exist", () => {
      const result = channelsForCurrentOrg(engine.state);
      expect(result).toEqual([]);
    });

    it("returns channels matching current orgId", () => {
      engine.rebase({
        channel: [
          {
            id: "ch-1",
            organizationId: "org-1",
            name: "general",
            topic: null,
            visibility: "public" as const,
            createdAt: 1000,
            updatedAt: 1000,
          },
          {
            id: "ch-2",
            organizationId: "org-1",
            name: "random",
            topic: "Fun stuff",
            visibility: "public" as const,
            createdAt: 2000,
            updatedAt: 2000,
          },
        ],
      });

      const result = channelsForCurrentOrg(engine.state);
      expect(result).toHaveLength(2);
      expect(result.map((c) => c.name)).toEqual(
        expect.arrayContaining(["general", "random"]),
      );
    });

    it("excludes channels from other orgs", () => {
      engine.rebase({
        channel: [
          {
            id: "ch-1",
            organizationId: "org-1",
            name: "general",
            topic: null,
            visibility: "public" as const,
            createdAt: 1000,
            updatedAt: 1000,
          },
          {
            id: "ch-other",
            organizationId: "org-other",
            name: "other-org-channel",
            topic: null,
            visibility: "public" as const,
            createdAt: 3000,
            updatedAt: 3000,
          },
        ],
      });

      const result = channelsForCurrentOrg(engine.state);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("general");
    });
  });

  describe("messagesForChannel", () => {
    it("returns empty array when no messages exist", () => {
      const result = messagesForChannel(engine.state, "ch-1");
      expect(result).toEqual([]);
    });

    it("returns only messages for specified channel", () => {
      engine.rebase({
        message: [
          {
            id: "msg-1",
            chatId: "ch-1",
            senderUserId: "user-1",
            threadId: null,
            text: "Hello",
            createdAt: 1000,
            editedAt: null,
            deletedAt: null,
            threadReplyCount: 0,
            threadLastReplyAt: null,
            sender: { id: "user-1", kind: "human", username: "alice", firstName: "Alice", lastName: null, avatarUrl: null },
            attachments: [],
            reactions: [],
          },
          {
            id: "msg-2",
            chatId: "ch-2",
            senderUserId: "user-1",
            threadId: null,
            text: "Other channel",
            createdAt: 2000,
            editedAt: null,
            deletedAt: null,
            threadReplyCount: 0,
            threadLastReplyAt: null,
            sender: { id: "user-1", kind: "human", username: "alice", firstName: "Alice", lastName: null, avatarUrl: null },
            attachments: [],
            reactions: [],
          },
        ],
      });

      const result = messagesForChannel(engine.state, "ch-1");
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("Hello");
    });

    it("excludes thread replies (non-null threadId)", () => {
      engine.rebase({
        message: [
          {
            id: "msg-1",
            chatId: "ch-1",
            senderUserId: "user-1",
            threadId: null,
            text: "Root message",
            createdAt: 1000,
            editedAt: null,
            deletedAt: null,
            threadReplyCount: 1,
            threadLastReplyAt: 2000,
            sender: { id: "user-1", kind: "human", username: "alice", firstName: "Alice", lastName: null, avatarUrl: null },
            attachments: [],
            reactions: [],
          },
          {
            id: "msg-2",
            chatId: "ch-1",
            senderUserId: "user-2",
            threadId: "msg-1",
            text: "Thread reply",
            createdAt: 2000,
            editedAt: null,
            deletedAt: null,
            threadReplyCount: 0,
            threadLastReplyAt: null,
            sender: { id: "user-2", kind: "human", username: "bob", firstName: "Bob", lastName: null, avatarUrl: null },
            attachments: [],
            reactions: [],
          },
        ],
      });

      const result = messagesForChannel(engine.state, "ch-1");
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("Root message");
    });

    it("sorts messages by createdAt ascending", () => {
      engine.rebase({
        message: [
          {
            id: "msg-3",
            chatId: "ch-1",
            senderUserId: "user-1",
            threadId: null,
            text: "Third",
            createdAt: 3000,
            editedAt: null,
            deletedAt: null,
            threadReplyCount: 0,
            threadLastReplyAt: null,
            sender: { id: "user-1", kind: "human", username: "alice", firstName: "Alice", lastName: null, avatarUrl: null },
            attachments: [],
            reactions: [],
          },
          {
            id: "msg-1",
            chatId: "ch-1",
            senderUserId: "user-1",
            threadId: null,
            text: "First",
            createdAt: 1000,
            editedAt: null,
            deletedAt: null,
            threadReplyCount: 0,
            threadLastReplyAt: null,
            sender: { id: "user-1", kind: "human", username: "alice", firstName: "Alice", lastName: null, avatarUrl: null },
            attachments: [],
            reactions: [],
          },
          {
            id: "msg-2",
            chatId: "ch-1",
            senderUserId: "user-1",
            threadId: null,
            text: "Second",
            createdAt: 2000,
            editedAt: null,
            deletedAt: null,
            threadReplyCount: 0,
            threadLastReplyAt: null,
            sender: { id: "user-1", kind: "human", username: "alice", firstName: "Alice", lastName: null, avatarUrl: null },
            attachments: [],
            reactions: [],
          },
        ],
      });

      const result = messagesForChannel(engine.state, "ch-1");
      expect(result.map((m) => m.text)).toEqual(["First", "Second", "Third"]);
    });
  });

  describe("threadMessagesForRoot", () => {
    it("returns empty array when no thread replies exist", () => {
      const result = threadMessagesForRoot(engine.state, "msg-1");
      expect(result).toEqual([]);
    });

    it("returns replies sorted by createdAt", () => {
      engine.rebase({
        message: [
          {
            id: "msg-1",
            chatId: "ch-1",
            senderUserId: "user-1",
            threadId: null,
            text: "Root",
            createdAt: 1000,
            editedAt: null,
            deletedAt: null,
            threadReplyCount: 2,
            threadLastReplyAt: 3000,
            sender: { id: "user-1", kind: "human", username: "alice", firstName: "Alice", lastName: null, avatarUrl: null },
            attachments: [],
            reactions: [],
          },
          {
            id: "reply-2",
            chatId: "ch-1",
            senderUserId: "user-2",
            threadId: "msg-1",
            text: "Second reply",
            createdAt: 3000,
            editedAt: null,
            deletedAt: null,
            threadReplyCount: 0,
            threadLastReplyAt: null,
            sender: { id: "user-2", kind: "human", username: "bob", firstName: "Bob", lastName: null, avatarUrl: null },
            attachments: [],
            reactions: [],
          },
          {
            id: "reply-1",
            chatId: "ch-1",
            senderUserId: "user-2",
            threadId: "msg-1",
            text: "First reply",
            createdAt: 2000,
            editedAt: null,
            deletedAt: null,
            threadReplyCount: 0,
            threadLastReplyAt: null,
            sender: { id: "user-2", kind: "human", username: "bob", firstName: "Bob", lastName: null, avatarUrl: null },
            attachments: [],
            reactions: [],
          },
        ],
      });

      const result = threadMessagesForRoot(engine.state, "msg-1");
      expect(result).toHaveLength(2);
      expect(result[0].text).toBe("First reply");
      expect(result[1].text).toBe("Second reply");
    });

    it("excludes messages from other threads", () => {
      engine.rebase({
        message: [
          {
            id: "reply-a",
            chatId: "ch-1",
            senderUserId: "user-1",
            threadId: "msg-1",
            text: "Reply to msg-1",
            createdAt: 2000,
            editedAt: null,
            deletedAt: null,
            threadReplyCount: 0,
            threadLastReplyAt: null,
            sender: { id: "user-1", kind: "human", username: "alice", firstName: "Alice", lastName: null, avatarUrl: null },
            attachments: [],
            reactions: [],
          },
          {
            id: "reply-b",
            chatId: "ch-1",
            senderUserId: "user-1",
            threadId: "msg-other",
            text: "Reply to different thread",
            createdAt: 3000,
            editedAt: null,
            deletedAt: null,
            threadReplyCount: 0,
            threadLastReplyAt: null,
            sender: { id: "user-1", kind: "human", username: "alice", firstName: "Alice", lastName: null, avatarUrl: null },
            attachments: [],
            reactions: [],
          },
        ],
      });

      const result = threadMessagesForRoot(engine.state, "msg-1");
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("Reply to msg-1");
    });
  });

  describe("unreadCountForChannel", () => {
    it("returns 0 when no readState exists for channel", () => {
      expect(unreadCountForChannel(engine.state, "ch-1")).toBe(0);
    });

    it("returns unreadCount from readState", () => {
      engine.rebase({
        readState: [
          { id: "ch-1", chatId: "ch-1", lastReadAt: 1000, unreadCount: 5 },
        ],
      });

      expect(unreadCountForChannel(engine.state, "ch-1")).toBe(5);
    });

    it("returns 0 when unreadCount is 0", () => {
      engine.rebase({
        readState: [
          { id: "ch-1", chatId: "ch-1", lastReadAt: 2000, unreadCount: 0 },
        ],
      });

      expect(unreadCountForChannel(engine.state, "ch-1")).toBe(0);
    });
  });

  describe("typingUsersForChannel", () => {
    it("returns empty array when no one is typing", () => {
      const result = typingUsersForChannel(engine.state, "ch-1", "user-1");
      expect(result).toEqual([]);
    });

    it("returns typing users for the channel, excluding self", () => {
      const future = Date.now() + 10000;
      engine.rebase({
        typing: [
          {
            id: "ch-1:user-2",
            userId: "user-2",
            username: "bob",
            firstName: "Bob",
            expiresAt: future,
          },
          {
            id: "ch-1:user-1",
            userId: "user-1",
            username: "alice",
            firstName: "Alice",
            expiresAt: future,
          },
        ],
      });

      const result = typingUsersForChannel(engine.state, "ch-1", "user-1");
      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe("user-2");
    });

    it("excludes expired typing entries", () => {
      const past = Date.now() - 10000;
      const future = Date.now() + 10000;
      engine.rebase({
        typing: [
          {
            id: "ch-1:user-2",
            userId: "user-2",
            username: "bob",
            firstName: "Bob",
            expiresAt: past,
          },
          {
            id: "ch-1:user-3",
            userId: "user-3",
            username: "carol",
            firstName: "Carol",
            expiresAt: future,
          },
        ],
      });

      const result = typingUsersForChannel(engine.state, "ch-1", "user-1");
      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe("user-3");
    });

    it("excludes typing users from other channels", () => {
      const future = Date.now() + 10000;
      engine.rebase({
        typing: [
          {
            id: "ch-1:user-2",
            userId: "user-2",
            username: "bob",
            firstName: "Bob",
            expiresAt: future,
          },
          {
            id: "ch-other:user-3",
            userId: "user-3",
            username: "carol",
            firstName: "Carol",
            expiresAt: future,
          },
        ],
      });

      const result = typingUsersForChannel(engine.state, "ch-1", "user-1");
      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe("user-2");
    });
  });

  describe("presenceForUser", () => {
    it("returns 'offline' when no presence data exists for user", () => {
      expect(presenceForUser(engine.state, "user-1")).toBe("offline");
    });

    it("returns 'online' when user is online", () => {
      engine.rebase({
        presence: [
          {
            id: "user-2",
            userId: "user-2",
            status: "online" as const,
            lastSeenAt: Date.now(),
          },
        ],
      });

      expect(presenceForUser(engine.state, "user-2")).toBe("online");
    });

    it("returns 'away' when user is away", () => {
      engine.rebase({
        presence: [
          {
            id: "user-2",
            userId: "user-2",
            status: "away" as const,
            lastSeenAt: Date.now(),
          },
        ],
      });

      expect(presenceForUser(engine.state, "user-2")).toBe("away");
    });

    it("returns 'offline' when user is offline", () => {
      engine.rebase({
        presence: [
          {
            id: "user-2",
            userId: "user-2",
            status: "offline" as const,
            lastSeenAt: Date.now(),
          },
        ],
      });

      expect(presenceForUser(engine.state, "user-2")).toBe("offline");
    });

    it("returns correct status for different users", () => {
      engine.rebase({
        presence: [
          {
            id: "user-2",
            userId: "user-2",
            status: "online" as const,
            lastSeenAt: Date.now(),
          },
          {
            id: "user-3",
            userId: "user-3",
            status: "away" as const,
            lastSeenAt: Date.now(),
          },
        ],
      });

      expect(presenceForUser(engine.state, "user-2")).toBe("online");
      expect(presenceForUser(engine.state, "user-3")).toBe("away");
      expect(presenceForUser(engine.state, "user-unknown")).toBe("offline");
    });
  });
});
