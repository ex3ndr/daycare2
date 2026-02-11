import { describe, it, expect, beforeEach, vi } from "vitest";
import { syncEngine, SyncEngine } from "@slopus/sync";
import { schema, Schema } from "./schema";
import { storageStoreCreate, StorageStore } from "./storageStoreCreate";
import type { StoreApi } from "zustand";

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

describe("storageStoreCreate", () => {
  let engine: SyncEngine<Schema>;
  let store: StoreApi<StorageStore>;

  beforeEach(() => {
    engine = createEngine();
    store = storageStoreCreate(engine);
  });

  it("initializes objects from engine state", () => {
    const state = store.getState();
    expect(state.objects.context.userId).toBe("user-1");
    expect(state.objects.context.orgId).toBe("org-1");
    expect(Object.keys(state.objects.channel)).toHaveLength(0);
    expect(Object.keys(state.objects.message)).toHaveLength(0);
  });

  describe("mutate", () => {
    it("applies mutation and updates objects", () => {
      store.getState().mutate("messageSend", {
        id: "msg-1",
        chatId: "ch-1",
        text: "Hello",
      });

      const state = store.getState();
      const msg = state.objects.message["msg-1"];
      expect(msg).toBeDefined();
      expect(msg.text).toBe("Hello");
      expect(msg.chatId).toBe("ch-1");
      expect(msg.senderUserId).toBe("user-1");
      expect(msg.pending).toBe(true);
    });

    it("adds mutation to engine pending list", () => {
      store.getState().mutate("messageSend", {
        id: "msg-1",
        chatId: "ch-1",
        text: "Hello",
      });

      expect(engine.pendingMutations).toHaveLength(1);
      expect(engine.pendingMutations[0].name).toBe("messageSend");
    });

    it("calls onMutate callback", () => {
      const onMutate = vi.fn();
      store = storageStoreCreate(engine, onMutate);

      store.getState().mutate("channelCreate", {
        id: "ch-1",
        name: "general",
      });

      expect(onMutate).toHaveBeenCalledOnce();
    });

    it("applies channelCreate mutation", () => {
      store.getState().mutate("channelCreate", {
        id: "ch-1",
        name: "general",
        topic: "Welcome",
        visibility: "public",
      });

      const ch = store.getState().objects.channel["ch-1"];
      expect(ch).toBeDefined();
      expect(ch.name).toBe("general");
      expect(ch.topic).toBe("Welcome");
      expect(ch.visibility).toBe("public");
      expect(ch.isJoined).toBe(true);
    });

    it("applies readMark mutation", () => {
      store.getState().mutate("readMark", { chatId: "ch-1" });

      const rs = store.getState().objects.readState["ch-1"];
      expect(rs).toBeDefined();
      expect(rs.unreadCount).toBe(0);
      expect(rs.lastReadAt).toBeTypeOf("number");
    });
  });

  describe("updateObjects", () => {
    it("syncs store objects with engine state after external rebase", () => {
      // Rebase directly on engine (simulating SSE update)
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

      // Store doesn't know about the rebase yet
      expect(Object.keys(store.getState().objects.channel)).toHaveLength(0);

      // Call updateObjects to sync
      store.getState().updateObjects();

      // Now store reflects engine state
      const ch = store.getState().objects.channel["ch-1"];
      expect(ch).toBeDefined();
      expect(ch.name).toBe("general");
    });

    it("reflects committed mutations after updateObjects", () => {
      store.getState().mutate("messageSend", {
        id: "msg-1",
        chatId: "ch-1",
        text: "Hello",
      });

      const mutId = engine.pendingMutations[0].id;

      // Rebase with server data and commit
      engine.rebase({
        message: [
          {
            id: "msg-1",
            chatId: "ch-1",
            senderUserId: "user-1",
            threadId: null,
            text: "Hello",
            createdAt: 2000,
            editedAt: null,
            deletedAt: null,
            threadReplyCount: 0,
            threadLastReplyAt: null,
            sender: {
              id: "user-1",
              kind: "human",
              username: "testuser",
              firstName: "Test",
              lastName: null,
              avatarUrl: null,
            },
            attachments: [],
            reactions: [],
          },
        ],
      });
      engine.commit(mutId);

      store.getState().updateObjects();

      // Message is now confirmed (pending = false since server data rebased)
      const msg = store.getState().objects.message["msg-1"];
      expect(msg).toBeDefined();
      expect(msg.text).toBe("Hello");
      expect(msg.pending).toBe(false);
      expect(engine.pendingMutations).toHaveLength(0);
    });
  });

  describe("rebaseLocal", () => {
    it("updates local fields without touching server fields", () => {
      // First set up a channel via server rebase
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
      store.getState().updateObjects();

      expect(store.getState().objects.channel["ch-1"].isJoined).toBe(false);

      // Update local field via rebaseLocal
      store.getState().rebaseLocal({
        channel: [{ id: "ch-1", isJoined: true }],
      });

      const ch = store.getState().objects.channel["ch-1"];
      expect(ch.isJoined).toBe(true);
      // Server fields preserved
      expect(ch.name).toBe("general");
      expect(ch.organizationId).toBe("org-1");
    });

    it("updates context local fields", () => {
      store.getState().rebaseLocal({
        context: { seqno: 42 },
      });

      expect(store.getState().objects.context.seqno).toBe(42);
      // Server fields preserved
      expect(store.getState().objects.context.userId).toBe("user-1");
    });
  });

  describe("reactivity", () => {
    it("triggers subscribers on mutate", () => {
      const listener = vi.fn();
      store.subscribe(listener);

      store.getState().mutate("messageSend", {
        id: "msg-1",
        chatId: "ch-1",
        text: "Hello",
      });

      expect(listener).toHaveBeenCalled();
    });

    it("triggers subscribers on updateObjects", () => {
      const listener = vi.fn();
      store.subscribe(listener);

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

      store.getState().updateObjects();

      expect(listener).toHaveBeenCalled();
    });

    it("triggers subscribers on rebaseLocal", () => {
      const listener = vi.fn();
      store.subscribe(listener);

      store.getState().rebaseLocal({
        context: { seqno: 10 },
      });

      expect(listener).toHaveBeenCalled();
    });
  });
});
