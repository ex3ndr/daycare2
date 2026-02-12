import { describe, it, expect, vi } from "vitest";
import { mutationApply } from "./mutationApply";
import type { ApiClient } from "../daycare/api/apiClientCreate";

function makeMutation(name: string, input: Record<string, unknown>) {
  return {
    id: `mut-${Date.now()}`,
    name,
    input,
    timestamp: Date.now(),
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
    channelUpdate: vi.fn(),
    channelArchive: vi.fn(),
    channelUnarchive: vi.fn(),
    channelMemberKick: vi.fn(),
    channelMemberRoleUpdate: vi.fn(),
    channelNotificationsUpdate: vi.fn(),
    presenceSet: vi.fn(),
    presenceHeartbeat: vi.fn(),
    presenceGet: vi.fn(),
    updatesDiff: vi.fn(),
    updatesStreamSubscribe: vi.fn(),
    orgMemberDeactivate: vi.fn(),
    orgMemberReactivate: vi.fn(),
    orgMemberRoleSet: vi.fn(),
    orgInviteCreate: vi.fn(),
    orgInviteList: vi.fn(),
    orgInviteRevoke: vi.fn(),
    orgDomainAdd: vi.fn(),
    orgDomainList: vi.fn(),
    orgDomainRemove: vi.fn(),
    channelMemberAdd: vi.fn(),
    organizationUpdate: vi.fn(),
  };
}

const token = "test-token";
const orgId = "org-1";

describe("mutationApply", () => {
  describe("messageSend", () => {
    it("calls api.messageSend and returns message snapshot", async () => {
      const api = createMockApi();
      const serverMessage = {
        id: "server-msg-1",
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
          kind: "human" as const,
          username: "alice",
          firstName: "Alice",
          lastName: null,
          avatarUrl: null,
        },
        attachments: [],
        reactions: [],
      };
      vi.mocked(api.messageSend).mockResolvedValue({ message: serverMessage });

      const mutation = makeMutation("messageSend", {
        id: "temp-msg-1",
        chatId: "ch-1",
        text: "Hello",
        threadId: null,
      });

      const result = await mutationApply(api, token, orgId, mutation);

      expect(api.messageSend).toHaveBeenCalledWith(token, orgId, {
        channelId: "ch-1",
        text: "Hello",
        threadId: null,
        attachments: undefined,
      });
      expect(result.snapshot.message).toHaveLength(1);
      // Snapshot uses the client-generated ID for stable React keys
      expect(result.snapshot.message![0].id).toBe("temp-msg-1");
      expect(result.snapshot.message![0].text).toBe("Hello");
      expect(result.snapshot.message![0].createdAt).toBe(2000);
      // idMapping tracks client-to-server ID for SSE dedup
      expect(result.idMapping).toEqual({
        type: "message",
        clientId: "temp-msg-1",
        serverId: "server-msg-1",
      });
    });

    it("sends empty text when message has attachments but no text", async () => {
      const api = createMockApi();
      const serverMessage = {
        id: "server-msg-2",
        chatId: "ch-1",
        senderUserId: "user-1",
        threadId: null,
        text: "",
        createdAt: 3000,
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
      vi.mocked(api.messageSend).mockResolvedValue({ message: serverMessage });

      const mutation = makeMutation("messageSend", {
        id: "temp-msg-2",
        chatId: "ch-1",
        text: "",
        attachments: [
          {
            kind: "file",
            url: "https://example.com/f.txt",
          },
        ],
      });

      await mutationApply(api, token, orgId, mutation);

      expect(api.messageSend).toHaveBeenCalledWith(token, orgId, {
        channelId: "ch-1",
        text: "",
        threadId: undefined,
        attachments: [
          {
            kind: "file",
            url: "https://example.com/f.txt",
          },
        ],
      });
    });
  });

  describe("messageEdit", () => {
    it("calls api.messageEdit and returns updated message snapshot", async () => {
      const api = createMockApi();
      const serverMessage = {
        id: "msg-1",
        chatId: "ch-1",
        senderUserId: "user-1",
        threadId: null,
        text: "Edited text",
        createdAt: 1000,
        editedAt: 3000,
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
      vi.mocked(api.messageEdit).mockResolvedValue({ message: serverMessage });

      const mutation = makeMutation("messageEdit", {
        id: "msg-1",
        text: "Edited text",
      });

      const result = await mutationApply(api, token, orgId, mutation);

      expect(api.messageEdit).toHaveBeenCalledWith(token, orgId, "msg-1", {
        text: "Edited text",
      });
      expect(result.snapshot.message![0].text).toBe("Edited text");
      expect(result.snapshot.message![0].editedAt).toBe(3000);
    });
  });

  describe("messageDelete", () => {
    it("calls api.messageDelete and returns empty snapshot", async () => {
      const api = createMockApi();
      vi.mocked(api.messageDelete).mockResolvedValue({
        deleted: true,
        messageId: "msg-1",
      });

      const mutation = makeMutation("messageDelete", { id: "msg-1" });

      const result = await mutationApply(api, token, orgId, mutation);

      expect(api.messageDelete).toHaveBeenCalledWith(token, orgId, "msg-1");
      expect(result.snapshot).toEqual({});
    });
  });

  describe("reactionToggle", () => {
    const baseMessage = {
      id: "msg-1",
      chatId: "ch-1",
      senderUserId: "user-2",
      threadId: null,
      text: "Hello",
      createdAt: 1000,
      editedAt: null,
      deletedAt: null,
      threadReplyCount: 0,
      threadLastReplyAt: null,
      sender: {
        id: "user-2",
        kind: "human" as const,
        username: "bob",
        firstName: "Bob",
        lastName: null,
        avatarUrl: null,
      },
      attachments: [],
      reactions: [] as Array<{ id: string; userId: string; shortcode: string; createdAt: number }>,
    };

    it("calls api.messageReactionAdd and returns message snapshot with reaction", async () => {
      const api = createMockApi();
      vi.mocked(api.messageReactionAdd).mockResolvedValue({ added: true });

      const mutation = makeMutation("reactionToggle", {
        messageId: "msg-1",
        shortcode: ":fire:",
      });

      const msgWithReaction = {
        ...baseMessage,
        reactions: [{ id: "user-1-:fire:", userId: "user-1", shortcode: ":fire:", createdAt: 2000 }],
      };

      const context = {
        userId: "user-1",
        messageReactions: {
          "msg-1": [{ userId: "user-1", shortcode: ":fire:" }],
        },
        messages: { "msg-1": msgWithReaction },
      };

      const result = await mutationApply(api, token, orgId, mutation, context);

      expect(api.messageReactionAdd).toHaveBeenCalledWith(
        token,
        orgId,
        "msg-1",
        { shortcode: ":fire:" },
      );
      expect(api.messageReactionRemove).not.toHaveBeenCalled();
      expect(result.snapshot.message).toHaveLength(1);
      expect(result.snapshot.message![0].id).toBe("msg-1");
      expect(result.snapshot.message![0].reactions).toHaveLength(1);
      expect(result.snapshot.message![0].reactions[0].shortcode).toBe(":fire:");
    });

    it("calls api.messageReactionRemove and returns message snapshot without reaction", async () => {
      const api = createMockApi();
      vi.mocked(api.messageReactionRemove).mockResolvedValue({
        removed: true,
      });

      const mutation = makeMutation("reactionToggle", {
        messageId: "msg-1",
        shortcode: ":fire:",
      });

      const context = {
        userId: "user-1",
        messageReactions: {
          "msg-1": [],
        },
        messages: { "msg-1": { ...baseMessage, reactions: [] } },
      };

      const result = await mutationApply(api, token, orgId, mutation, context);

      expect(api.messageReactionAdd).not.toHaveBeenCalled();
      expect(api.messageReactionRemove).toHaveBeenCalledWith(
        token,
        orgId,
        "msg-1",
        { shortcode: ":fire:" },
      );
      expect(result.snapshot.message).toHaveLength(1);
      expect(result.snapshot.message![0].reactions).toHaveLength(0);
    });

    it("returns empty snapshot when no message context provided", async () => {
      const api = createMockApi();
      vi.mocked(api.messageReactionAdd).mockResolvedValue({ added: true });

      const mutation = makeMutation("reactionToggle", {
        messageId: "msg-1",
        shortcode: ":fire:",
      });

      const context = {
        userId: "user-1",
        messageReactions: {
          "msg-1": [{ userId: "user-1", shortcode: ":fire:" }],
        },
      };

      const result = await mutationApply(api, token, orgId, mutation, context);
      expect(result.snapshot).toEqual({});
    });
  });

  describe("channelCreate", () => {
    it("calls api.channelCreate and returns channel snapshot", async () => {
      const api = createMockApi();
      const serverChannel = {
        id: "server-ch-1",
        organizationId: "org-1",
        name: "general",
        topic: null,
        visibility: "public" as const,
        createdAt: 2000,
        updatedAt: 2000,
      };
      vi.mocked(api.channelCreate).mockResolvedValue({
        channel: serverChannel,
      });

      const mutation = makeMutation("channelCreate", {
        id: "temp-ch-1",
        name: "general",
        topic: null,
        visibility: "public",
      });

      const result = await mutationApply(api, token, orgId, mutation);

      expect(api.channelCreate).toHaveBeenCalledWith(token, orgId, {
        name: "general",
        topic: null,
        visibility: "public",
      });
      expect(result.snapshot.channel).toHaveLength(1);
      expect(result.snapshot.channel![0].id).toBe("server-ch-1");
      expect(result.snapshot.channel![0].name).toBe("general");
    });
  });

  describe("channelUpdate", () => {
    it("calls api.channelUpdate and returns channel snapshot", async () => {
      const api = createMockApi();
      const serverChannel = {
        id: "ch-1",
        organizationId: "org-1",
        name: "renamed",
        topic: "New topic",
        visibility: "public" as const,
        createdAt: 1000,
        updatedAt: 5000,
      };
      vi.mocked(api.channelUpdate).mockResolvedValue({
        channel: serverChannel,
      });

      const mutation = makeMutation("channelUpdate", {
        id: "ch-1",
        name: "renamed",
        topic: "New topic",
      });

      const result = await mutationApply(api, token, orgId, mutation);

      expect(api.channelUpdate).toHaveBeenCalledWith(token, orgId, "ch-1", {
        name: "renamed",
        topic: "New topic",
        visibility: undefined,
      });
      expect(result.snapshot.channel).toHaveLength(1);
      expect(result.snapshot.channel![0].id).toBe("ch-1");
      expect(result.snapshot.channel![0].name).toBe("renamed");
      expect(result.snapshot.channel![0].topic).toBe("New topic");
      expect(result.snapshot.channel![0].updatedAt).toBe(5000);
    });
  });

  describe("readMark", () => {
    it("calls api.readStateSet and returns readState snapshot", async () => {
      const api = createMockApi();
      vi.mocked(api.readStateSet).mockResolvedValue({
        chatId: "ch-1",
        lastReadAt: 5000,
      });

      const mutation = makeMutation("readMark", { chatId: "ch-1" });

      const result = await mutationApply(api, token, orgId, mutation);

      expect(api.readStateSet).toHaveBeenCalledWith(token, orgId, "ch-1");
      expect(result.snapshot.readState).toHaveLength(1);
      expect(result.snapshot.readState![0].chatId).toBe("ch-1");
      expect(result.snapshot.readState![0].lastReadAt).toBe(5000);
      expect(result.snapshot.readState![0].unreadCount).toBe(0);
    });
  });

  describe("unknown mutation", () => {
    it("throws for unknown mutation names", async () => {
      const api = createMockApi();
      const mutation = makeMutation("unknownMutation", {});

      await expect(
        mutationApply(api, token, orgId, mutation),
      ).rejects.toThrow("Unknown mutation: unknownMutation");
    });
  });
});
