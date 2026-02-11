import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AppController } from "./AppController";
import type { ApiClient } from "../daycare/api/apiClientCreate";

// Node 22 has a broken built-in localStorage (requires --localstorage-file).
// Replace it with a simple in-memory mock for tests.
function createMockStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    get length() { return store.size; },
    key: (index: number) => [...store.keys()][index] ?? null,
  };
}

function createMockApi(): ApiClient {
  return {
    authLogin: vi.fn(),
    authRequestOtp: vi.fn(),
    authVerifyOtp: vi.fn(),
    authLogout: vi.fn(),
    meGet: vi.fn(),
    organizationAvailableList: vi.fn(),
    organizationCreate: vi.fn(),
    organizationJoin: vi.fn(),
    organizationGet: vi.fn(),
    organizationMembers: vi.fn(),
    profileGet: vi.fn(),
    profilePatch: vi.fn(),
    channelList: vi.fn(),
    channelCreate: vi.fn(),
    channelJoin: vi.fn(),
    channelLeave: vi.fn(),
    channelMembers: vi.fn(),
    messageList: vi.fn(),
    messageSend: vi.fn(),
    messageEdit: vi.fn(),
    messageDelete: vi.fn(),
    messageReactionAdd: vi.fn(),
    messageReactionRemove: vi.fn(),
    typingUpsert: vi.fn(),
    typingList: vi.fn(),
    readStateSet: vi.fn(),
    readStateGet: vi.fn(),
    directList: vi.fn(),
    directCreate: vi.fn(),
    fileUploadInit: vi.fn(),
    fileUpload: vi.fn(),
    fileGet: vi.fn(),
    searchMessages: vi.fn(),
    searchChannels: vi.fn(),
    updatesDiff: vi.fn(),
    updatesStreamSubscribe: vi.fn(),
  };
}

function makeMessage(id: string, chatId: string, createdAt: number) {
  return {
    id,
    chatId,
    senderUserId: "user-1",
    threadId: null,
    text: `Message ${id}`,
    createdAt,
    editedAt: null,
    deletedAt: null,
    threadReplyCount: 0,
    threadLastReplyAt: null,
    sender: {
      id: "user-1",
      kind: "human" as const,
      username: "alice",
      firstName: "Alice",
      lastName: null,
      avatarUrl: null,
    },
    attachments: [],
    reactions: [],
  };
}

const token = "test-token";
const orgId = "org-1";

describe("AppController", () => {
  let api: ApiClient;
  let controller: AppController;
  let origStorage: Storage;

  beforeEach(() => {
    origStorage = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", {
      value: createMockStorage(),
      writable: true,
      configurable: true,
    });
    api = createMockApi();
    controller = AppController.createWithOrg(
      api,
      token,
      "user-1",
      orgId,
      "test-org",
      "Test Org",
    );
  });

  afterEach(() => {
    controller.destroy();
    Object.defineProperty(globalThis, "localStorage", {
      value: origStorage,
      writable: true,
      configurable: true,
    });
  });

  describe("syncMessages", () => {
    it("fetches all messages and rebases into engine", async () => {
      const messages = [
        makeMessage("msg-1", "ch-1", 1000),
        makeMessage("msg-2", "ch-1", 2000),
        makeMessage("msg-3", "ch-1", 3000),
      ];
      vi.mocked(api.messageList).mockResolvedValue({ messages });

      await controller.syncMessages("ch-1");

      expect(api.messageList).toHaveBeenCalledWith(token, orgId, "ch-1");
      const state = controller.storage.getState().objects;
      expect(Object.keys(state.message)).toHaveLength(3);
      expect(state.message["msg-1"].text).toBe("Message msg-1");
      expect(state.message["msg-3"].text).toBe("Message msg-3");
    });
  });

  describe("syncMessagesPage", () => {
    it("fetches messages with before cursor and limit", async () => {
      const messages = [
        makeMessage("msg-old-1", "ch-1", 500),
        makeMessage("msg-old-2", "ch-1", 600),
      ];
      vi.mocked(api.messageList).mockResolvedValue({ messages });

      const result = await controller.syncMessagesPage("ch-1", {
        before: "msg-1",
        limit: 50,
      });

      expect(api.messageList).toHaveBeenCalledWith(token, orgId, "ch-1", {
        before: "msg-1",
        limit: 50,
      });
      expect(result.fetchedCount).toBe(2);
    });

    it("merges paginated messages into existing state", async () => {
      // First load some messages
      vi.mocked(api.messageList).mockResolvedValueOnce({
        messages: [
          makeMessage("msg-1", "ch-1", 1000),
          makeMessage("msg-2", "ch-1", 2000),
        ],
      });
      await controller.syncMessages("ch-1");

      // Then load older messages
      vi.mocked(api.messageList).mockResolvedValueOnce({
        messages: [
          makeMessage("msg-old-1", "ch-1", 500),
          makeMessage("msg-old-2", "ch-1", 600),
        ],
      });
      await controller.syncMessagesPage("ch-1", {
        before: "msg-1",
        limit: 50,
      });

      const state = controller.storage.getState().objects;
      expect(Object.keys(state.message)).toHaveLength(4);
      expect(state.message["msg-old-1"]).toBeDefined();
      expect(state.message["msg-old-2"]).toBeDefined();
      expect(state.message["msg-1"]).toBeDefined();
      expect(state.message["msg-2"]).toBeDefined();
    });

    it("returns fetchedCount matching number of messages from server", async () => {
      const messages = Array.from({ length: 50 }, (_, i) =>
        makeMessage(`msg-${i}`, "ch-1", i * 100),
      );
      vi.mocked(api.messageList).mockResolvedValue({ messages });

      const result = await controller.syncMessagesPage("ch-1", {
        before: "msg-start",
        limit: 50,
      });

      expect(result.fetchedCount).toBe(50);
    });

    it("returns fetchedCount=0 when no messages returned", async () => {
      vi.mocked(api.messageList).mockResolvedValue({ messages: [] });

      const result = await controller.syncMessagesPage("ch-1", {
        before: "msg-start",
        limit: 50,
      });

      expect(result.fetchedCount).toBe(0);
    });

    it("does not fetch if controller is destroyed", async () => {
      controller.destroy();

      const result = await controller.syncMessagesPage("ch-1", {
        before: "msg-1",
        limit: 50,
      });

      expect(api.messageList).not.toHaveBeenCalled();
      expect(result.fetchedCount).toBe(0);
    });

    it("persists state after page load", async () => {
      const messages = [makeMessage("msg-old-1", "ch-1", 500)];
      vi.mocked(api.messageList).mockResolvedValue({ messages });

      await controller.syncMessagesPage("ch-1", {
        before: "msg-1",
        limit: 50,
      });

      const saved = localStorage.getItem("daycare:engine");
      expect(saved).toBeTruthy();
      expect(saved).toContain("msg-old-1");
    });
  });
});
