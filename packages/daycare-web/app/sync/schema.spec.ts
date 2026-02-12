import { describe, it, expect, beforeEach } from "vitest";
import { syncEngine, SyncEngine } from "@slopus/sync";
import { schema, Schema } from "./schema";

function createEngine() {
  return syncEngine(schema, {
    from: "new",
    objects: {
      context: {
        userId: "user-1",
        orgId: "org-1",
        orgSlug: "test-org",
        orgName: "Test Org",
        username: "testuser",
        firstName: "Test",
        lastName: "User",
        avatarUrl: null,
      },
    },
  });
}

describe("schema", () => {
  let engine: SyncEngine<Schema>;

  beforeEach(() => {
    engine = createEngine();
  });

  it("initializes with empty collections and context", () => {
    expect(engine.state.context.userId).toBe("user-1");
    expect(engine.state.context.orgId).toBe("org-1");
    expect(engine.state.context.orgSlug).toBe("test-org");
    expect(engine.state.context.orgName).toBe("Test Org");
    expect(engine.state.context.seqno).toBe(0);
    expect(Object.keys(engine.state.channel)).toHaveLength(0);
    expect(Object.keys(engine.state.message)).toHaveLength(0);
    expect(Object.keys(engine.state.member)).toHaveLength(0);
    expect(Object.keys(engine.state.readState)).toHaveLength(0);
    expect(Object.keys(engine.state.typing)).toHaveLength(0);
  });

  describe("messageSend", () => {
    it("creates a message with pending flag", () => {
      engine.mutate("messageSend", {
        id: "msg-1",
        chatId: "ch-1",
        text: "Hello world",
      });

      const msg = engine.state.message["msg-1"];
      expect(msg).toBeDefined();
      expect(msg.chatId).toBe("ch-1");
      expect(msg.senderUserId).toBe("user-1");
      expect(msg.text).toBe("Hello world");
      expect(msg.threadId).toBeNull();
      expect(msg.editedAt).toBeNull();
      expect(msg.deletedAt).toBeNull();
      expect(msg.threadReplyCount).toBe(0);
      expect(msg.threadLastReplyAt).toBeNull();
      expect(msg.attachments).toEqual([]);
      expect(msg.reactions).toEqual([]);
      expect(msg.pending).toBe(true);
      expect(msg.sender.id).toBe("user-1");
      expect(msg.sender.kind).toBe("human");
    });

    it("creates a thread reply with threadId", () => {
      engine.mutate("messageSend", {
        id: "msg-2",
        chatId: "ch-1",
        text: "Thread reply",
        threadId: "msg-1",
      });

      const msg = engine.state.message["msg-2"];
      expect(msg.threadId).toBe("msg-1");
    });

    it("adds mutation to pending list", () => {
      engine.mutate("messageSend", {
        id: "msg-1",
        chatId: "ch-1",
        text: "Test",
      });

      expect(engine.pendingMutations).toHaveLength(1);
      expect(engine.pendingMutations[0].name).toBe("messageSend");
    });
  });

  describe("messageEdit", () => {
    it("updates text and sets editedAt", () => {
      engine.mutate("messageSend", {
        id: "msg-1",
        chatId: "ch-1",
        text: "Original",
      });

      engine.mutate("messageEdit", {
        id: "msg-1",
        text: "Edited text",
      });

      const msg = engine.state.message["msg-1"];
      expect(msg.text).toBe("Edited text");
      expect(msg.editedAt).toBeTypeOf("number");
      expect(msg.editedAt).toBeGreaterThan(0);
    });

    it("does nothing for non-existent message", () => {
      engine.mutate("messageEdit", {
        id: "msg-nonexistent",
        text: "Nope",
      });

      expect(engine.state.message["msg-nonexistent"]).toBeUndefined();
    });
  });

  describe("messageDelete", () => {
    it("sets deletedAt on existing message", () => {
      engine.mutate("messageSend", {
        id: "msg-1",
        chatId: "ch-1",
        text: "To delete",
      });

      engine.mutate("messageDelete", { id: "msg-1" });

      const msg = engine.state.message["msg-1"];
      expect(msg.deletedAt).toBeTypeOf("number");
      expect(msg.deletedAt).toBeGreaterThan(0);
    });

    it("does nothing for non-existent message", () => {
      engine.mutate("messageDelete", { id: "msg-nonexistent" });
      expect(engine.state.message["msg-nonexistent"]).toBeUndefined();
    });
  });

  describe("reactionToggle", () => {
    beforeEach(() => {
      engine.mutate("messageSend", {
        id: "msg-1",
        chatId: "ch-1",
        text: "React to me",
      });
    });

    it("adds a reaction when none exists", () => {
      engine.mutate("reactionToggle", {
        messageId: "msg-1",
        shortcode: ":fire:",
      });

      const msg = engine.state.message["msg-1"];
      expect(msg.reactions).toHaveLength(1);
      expect(msg.reactions[0].userId).toBe("user-1");
      expect(msg.reactions[0].shortcode).toBe(":fire:");
      expect(msg.reactions[0].createdAt).toBeTypeOf("number");
    });

    it("removes a reaction when it already exists", () => {
      engine.mutate("reactionToggle", {
        messageId: "msg-1",
        shortcode: ":fire:",
      });
      engine.mutate("reactionToggle", {
        messageId: "msg-1",
        shortcode: ":fire:",
      });

      const msg = engine.state.message["msg-1"];
      expect(msg.reactions).toHaveLength(0);
    });

    it("preserves other reactions when toggling", () => {
      engine.mutate("reactionToggle", {
        messageId: "msg-1",
        shortcode: ":fire:",
      });
      engine.mutate("reactionToggle", {
        messageId: "msg-1",
        shortcode: ":heart:",
      });

      expect(engine.state.message["msg-1"].reactions).toHaveLength(2);

      engine.mutate("reactionToggle", {
        messageId: "msg-1",
        shortcode: ":fire:",
      });

      const reactions = engine.state.message["msg-1"].reactions;
      expect(reactions).toHaveLength(1);
      expect(reactions[0].shortcode).toBe(":heart:");
    });

    it("does nothing for non-existent message", () => {
      engine.mutate("reactionToggle", {
        messageId: "msg-nonexistent",
        shortcode: ":fire:",
      });
      expect(engine.state.message["msg-nonexistent"]).toBeUndefined();
    });
  });

  describe("channelCreate", () => {
    it("creates a channel with defaults", () => {
      engine.mutate("channelCreate", {
        id: "ch-1",
        name: "general",
      });

      const ch = engine.state.channel["ch-1"];
      expect(ch).toBeDefined();
      expect(ch.name).toBe("general");
      expect(ch.organizationId).toBe("org-1");
      expect(ch.topic).toBeNull();
      expect(ch.visibility).toBe("public");
      expect(ch.isJoined).toBe(true);
      expect(ch.createdAt).toBeTypeOf("number");
      expect(ch.updatedAt).toBeTypeOf("number");
    });

    it("creates a channel with explicit topic and visibility", () => {
      engine.mutate("channelCreate", {
        id: "ch-2",
        name: "private-room",
        topic: "Secret stuff",
        visibility: "private",
      });

      const ch = engine.state.channel["ch-2"];
      expect(ch.name).toBe("private-room");
      expect(ch.topic).toBe("Secret stuff");
      expect(ch.visibility).toBe("private");
    });
  });

  describe("channelUpdate", () => {
    beforeEach(() => {
      engine.mutate("channelCreate", {
        id: "ch-1",
        name: "general",
        topic: "Old topic",
        visibility: "public",
      });
    });

    it("updates channel name", () => {
      engine.mutate("channelUpdate", {
        id: "ch-1",
        name: "renamed",
      });

      const ch = engine.state.channel["ch-1"];
      expect(ch.name).toBe("renamed");
      expect(ch.topic).toBe("Old topic");
      expect(ch.visibility).toBe("public");
    });

    it("updates channel topic", () => {
      engine.mutate("channelUpdate", {
        id: "ch-1",
        topic: "New topic",
      });

      const ch = engine.state.channel["ch-1"];
      expect(ch.name).toBe("general");
      expect(ch.topic).toBe("New topic");
    });

    it("clears topic to null", () => {
      engine.mutate("channelUpdate", {
        id: "ch-1",
        topic: null,
      });

      const ch = engine.state.channel["ch-1"];
      expect(ch.topic).toBeNull();
    });

    it("updates visibility", () => {
      engine.mutate("channelUpdate", {
        id: "ch-1",
        visibility: "private",
      });

      const ch = engine.state.channel["ch-1"];
      expect(ch.visibility).toBe("private");
    });

    it("updates updatedAt timestamp", () => {
      const before = engine.state.channel["ch-1"].updatedAt;

      engine.mutate("channelUpdate", {
        id: "ch-1",
        name: "updated",
      });

      expect(engine.state.channel["ch-1"].updatedAt).toBeGreaterThanOrEqual(before);
    });

    it("does nothing for non-existent channel", () => {
      engine.mutate("channelUpdate", {
        id: "ch-nonexistent",
        name: "nope",
      });

      expect(engine.state.channel["ch-nonexistent"]).toBeUndefined();
    });
  });

  describe("readMark", () => {
    it("creates readState entry if none exists", () => {
      engine.mutate("readMark", { chatId: "ch-1" });

      const rs = engine.state.readState["ch-1"];
      expect(rs).toBeDefined();
      expect(rs.chatId).toBe("ch-1");
      expect(rs.lastReadAt).toBeTypeOf("number");
      expect(rs.unreadCount).toBe(0);
    });

    it("updates existing readState", () => {
      // Simulate existing readState via rebase
      engine.rebase({
        readState: [
          { id: "ch-1", chatId: "ch-1", lastReadAt: 1000, unreadCount: 5 },
        ],
      });

      engine.mutate("readMark", { chatId: "ch-1" });

      const rs = engine.state.readState["ch-1"];
      expect(rs.unreadCount).toBe(0);
      expect(rs.lastReadAt).toBeGreaterThan(1000);
    });
  });

  describe("optimistic lifecycle", () => {
    it("optimistic send + rebase(client ID) + commit preserves message with stable ID", () => {
      engine.mutate("messageSend", {
        id: "client-msg-1",
        chatId: "ch-1",
        text: "Hello",
      });

      expect(engine.state.message["client-msg-1"]).toBeDefined();
      expect(engine.state.message["client-msg-1"].pending).toBe(true);

      const mutId = engine.pendingMutations[0].id;

      // Rebase with server-confirmed data using the client ID
      engine.rebase({
        message: [
          {
            id: "client-msg-1",
            chatId: "ch-1",
            senderUserId: "user-1",
            threadId: null,
            text: "Hello",
            createdAt: 5000,
            editedAt: null,
            deletedAt: null,
            threadReplyCount: 0,
            threadLastReplyAt: null,
            sender: {
              id: "user-1",
              kind: "human",
              username: "testuser",
              firstName: "Test",
              lastName: "User",
              avatarUrl: null,
            },
            attachments: [],
            reactions: [],
          },
        ],
      });

      engine.commit(mutId);

      // Message persists with same ID, pending cleared
      const msg = engine.state.message["client-msg-1"];
      expect(msg).toBeDefined();
      expect(msg.text).toBe("Hello");
      expect(msg.createdAt).toBe(5000);
      expect(msg.pending).toBe(false);
      expect(engine.pendingMutations).toHaveLength(0);
    });

    it("optimistic send + commit on failure removes message from state", () => {
      engine.mutate("messageSend", {
        id: "fail-msg-1",
        chatId: "ch-1",
        text: "This will fail",
      });

      expect(engine.state.message["fail-msg-1"]).toBeDefined();

      const mutId = engine.pendingMutations[0].id;

      // No rebase (API failed) — just commit to discard
      engine.commit(mutId);

      expect(engine.state.message["fail-msg-1"]).toBeUndefined();
      expect(engine.pendingMutations).toHaveLength(0);
    });

    it("optimistic reaction + rebase(full msg) + commit preserves reaction", () => {
      // Set up a server-confirmed message
      engine.rebase({
        message: [
          {
            id: "msg-1",
            chatId: "ch-1",
            senderUserId: "user-2",
            threadId: null,
            text: "React to me",
            createdAt: 1000,
            editedAt: null,
            deletedAt: null,
            threadReplyCount: 0,
            threadLastReplyAt: null,
            sender: {
              id: "user-2",
              kind: "human",
              username: "bob",
              firstName: "Bob",
              lastName: null,
              avatarUrl: null,
            },
            attachments: [],
            reactions: [],
          },
        ],
      });

      // Optimistic reaction toggle
      engine.mutate("reactionToggle", {
        messageId: "msg-1",
        shortcode: ":fire:",
      });

      expect(engine.state.message["msg-1"].reactions).toHaveLength(1);
      expect(engine.state.message["msg-1"].reactions[0].shortcode).toBe(":fire:");

      const mutId = engine.pendingMutations[0].id;

      // Rebase with the full message (including the reaction from optimistic state)
      engine.rebase({
        message: [
          {
            id: "msg-1",
            chatId: "ch-1",
            senderUserId: "user-2",
            threadId: null,
            text: "React to me",
            createdAt: 1000,
            editedAt: null,
            deletedAt: null,
            threadReplyCount: 0,
            threadLastReplyAt: null,
            sender: {
              id: "user-2",
              kind: "human",
              username: "bob",
              firstName: "Bob",
              lastName: null,
              avatarUrl: null,
            },
            attachments: [],
            reactions: [
              {
                id: "user-1-:fire:",
                userId: "user-1",
                shortcode: ":fire:",
                createdAt: 2000,
              },
            ],
          },
        ],
      });

      engine.commit(mutId);

      // Reaction persists after commit
      const msg = engine.state.message["msg-1"];
      expect(msg.reactions).toHaveLength(1);
      expect(msg.reactions[0].shortcode).toBe(":fire:");
      expect(msg.reactions[0].userId).toBe("user-1");
    });

    it("message edit + rebase + commit preserves edit", () => {
      // Create and confirm a message
      engine.mutate("messageSend", {
        id: "msg-1",
        chatId: "ch-1",
        text: "Original",
      });
      const sendMutId = engine.pendingMutations[0].id;
      engine.rebase({
        message: [
          {
            id: "msg-1",
            chatId: "ch-1",
            senderUserId: "user-1",
            threadId: null,
            text: "Original",
            createdAt: 1000,
            editedAt: null,
            deletedAt: null,
            threadReplyCount: 0,
            threadLastReplyAt: null,
            sender: {
              id: "user-1",
              kind: "human",
              username: "testuser",
              firstName: "Test",
              lastName: "User",
              avatarUrl: null,
            },
            attachments: [],
            reactions: [],
          },
        ],
      });
      engine.commit(sendMutId);

      // Now edit
      engine.mutate("messageEdit", { id: "msg-1", text: "Edited" });
      expect(engine.state.message["msg-1"].text).toBe("Edited");

      const editMutId = engine.pendingMutations[0].id;

      // Rebase with server-confirmed edit
      engine.rebase({
        message: [
          {
            id: "msg-1",
            chatId: "ch-1",
            senderUserId: "user-1",
            threadId: null,
            text: "Edited",
            createdAt: 1000,
            editedAt: 3000,
            deletedAt: null,
            threadReplyCount: 0,
            threadLastReplyAt: null,
            sender: {
              id: "user-1",
              kind: "human",
              username: "testuser",
              firstName: "Test",
              lastName: "User",
              avatarUrl: null,
            },
            attachments: [],
            reactions: [],
          },
        ],
      });
      engine.commit(editMutId);

      const msg = engine.state.message["msg-1"];
      expect(msg.text).toBe("Edited");
      expect(msg.editedAt).toBe(3000);
      expect(engine.pendingMutations).toHaveLength(0);
    });
  });

  describe("engine operations", () => {
    it("rebase merges server data", () => {
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
        ],
      });

      const ch = engine.state.channel["ch-1"];
      expect(ch).toBeDefined();
      expect(ch.name).toBe("general");
      expect(ch.isJoined).toBe(false); // local field keeps default
    });

    it("commit removes mutation from pending", () => {
      engine.mutate("messageSend", {
        id: "msg-1",
        chatId: "ch-1",
        text: "Hello",
      });

      const mutId = engine.pendingMutations[0].id;
      expect(engine.pendingMutations).toHaveLength(1);

      engine.commit(mutId);
      expect(engine.pendingMutations).toHaveLength(0);
    });

    it("persist and restore round-trips", () => {
      engine.mutate("channelCreate", {
        id: "ch-1",
        name: "general",
      });

      const data = engine.persist();
      const restored = syncEngine(schema, { from: "restore", data });

      expect(restored.state.context.userId).toBe("user-1");
      expect(restored.state.channel["ch-1"]).toBeDefined();
      expect(restored.state.channel["ch-1"].name).toBe("general");
      expect(restored.pendingMutations).toHaveLength(1);
    });

    it("rebase with local fields only", () => {
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
        ],
      });

      engine.rebase(
        { channel: [{ id: "ch-1", isJoined: true }] },
        { allowLocalFields: true, allowServerFields: false },
      );

      expect(engine.state.channel["ch-1"].isJoined).toBe(true);
      expect(engine.state.channel["ch-1"].name).toBe("general");
    });
  });
});
