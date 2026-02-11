import { describe, it, expect } from "vitest";
import { mapEventToRebase } from "./eventMappers";
import type { UpdateEnvelope, Message, Channel, User } from "../daycare/types";

function makeEnvelope(
  eventType: string,
  payload: Record<string, unknown>,
  seqno = 1,
): UpdateEnvelope {
  return {
    id: `update-${seqno}`,
    userId: "user-1",
    seqno,
    eventType,
    payload,
    createdAt: Date.now(),
  };
}

const testMessage: Message = {
  id: "msg-1",
  chatId: "ch-1",
  senderUserId: "user-1",
  threadId: null,
  text: "Hello world",
  createdAt: 1000,
  editedAt: null,
  deletedAt: null,
  threadReplyCount: 0,
  threadLastReplyAt: null,
  sender: {
    id: "user-1",
    kind: "human",
    username: "alice",
    firstName: "Alice",
    lastName: null,
    avatarUrl: null,
  },
  attachments: [],
  reactions: [],
};

const testChannel: Channel = {
  id: "ch-1",
  organizationId: "org-1",
  name: "general",
  topic: "Welcome",
  visibility: "public",
  createdAt: 1000,
  updatedAt: 2000,
};

const testUser: User = {
  id: "user-2",
  organizationId: "org-1",
  kind: "human",
  username: "bob",
  firstName: "Bob",
  lastName: "Smith",
  avatarUrl: "https://example.com/bob.jpg",
  createdAt: 1000,
  updatedAt: 2000,
};

describe("mapEventToRebase", () => {
  describe("message.created", () => {
    it("returns message rebase shape", () => {
      const result = mapEventToRebase(
        makeEnvelope("message.created", { message: testMessage }),
      );

      expect(result).not.toBeNull();
      expect(result!.message).toHaveLength(1);
      expect(result!.message![0].id).toBe("msg-1");
      expect(result!.message![0].chatId).toBe("ch-1");
      expect(result!.message![0].text).toBe("Hello world");
      expect(result!.message![0].sender.username).toBe("alice");
    });

    it("returns null when message payload is missing", () => {
      const result = mapEventToRebase(
        makeEnvelope("message.created", {}),
      );
      expect(result).toBeNull();
    });
  });

  describe("message.updated", () => {
    it("returns message rebase shape with updated fields", () => {
      const edited = { ...testMessage, text: "Edited", editedAt: 3000 };
      const result = mapEventToRebase(
        makeEnvelope("message.updated", { message: edited }),
      );

      expect(result).not.toBeNull();
      expect(result!.message![0].text).toBe("Edited");
      expect(result!.message![0].editedAt).toBe(3000);
    });
  });

  describe("message.deleted", () => {
    it("returns message rebase shape with deletedAt", () => {
      const deleted = { ...testMessage, deletedAt: 4000 };
      const result = mapEventToRebase(
        makeEnvelope("message.deleted", { message: deleted }),
      );

      expect(result).not.toBeNull();
      expect(result!.message![0].deletedAt).toBe(4000);
    });
  });

  describe("channel.created", () => {
    it("returns channel rebase shape", () => {
      const result = mapEventToRebase(
        makeEnvelope("channel.created", { channel: testChannel }),
      );

      expect(result).not.toBeNull();
      expect(result!.channel).toHaveLength(1);
      expect(result!.channel![0].id).toBe("ch-1");
      expect(result!.channel![0].name).toBe("general");
      expect(result!.channel![0].topic).toBe("Welcome");
      expect(result!.channel![0].visibility).toBe("public");
    });

    it("returns null when channel payload is missing", () => {
      const result = mapEventToRebase(
        makeEnvelope("channel.created", {}),
      );
      expect(result).toBeNull();
    });
  });

  describe("channel.updated", () => {
    it("returns channel rebase shape with updated fields", () => {
      const updated = { ...testChannel, name: "renamed", updatedAt: 5000 };
      const result = mapEventToRebase(
        makeEnvelope("channel.updated", { channel: updated }),
      );

      expect(result).not.toBeNull();
      expect(result!.channel![0].name).toBe("renamed");
      expect(result!.channel![0].updatedAt).toBe(5000);
    });
  });

  describe("member.joined", () => {
    it("returns member rebase shape", () => {
      const result = mapEventToRebase(
        makeEnvelope("member.joined", { user: testUser }),
      );

      expect(result).not.toBeNull();
      expect(result!.member).toHaveLength(1);
      expect(result!.member![0].id).toBe("user-2");
      expect(result!.member![0].kind).toBe("human");
      expect(result!.member![0].username).toBe("bob");
      expect(result!.member![0].firstName).toBe("Bob");
      expect(result!.member![0].lastName).toBe("Smith");
      expect(result!.member![0].avatarUrl).toBe("https://example.com/bob.jpg");
    });

    it("returns null when user payload is missing", () => {
      const result = mapEventToRebase(
        makeEnvelope("member.joined", {}),
      );
      expect(result).toBeNull();
    });
  });

  describe("member.left", () => {
    it("returns null (member data is kept for past messages)", () => {
      const result = mapEventToRebase(
        makeEnvelope("member.left", { user: testUser }),
      );
      expect(result).toBeNull();
    });
  });

  describe("member.updated", () => {
    it("returns member rebase shape", () => {
      const updated = { ...testUser, firstName: "Robert" };
      const result = mapEventToRebase(
        makeEnvelope("member.updated", { user: updated }),
      );

      expect(result).not.toBeNull();
      expect(result!.member![0].firstName).toBe("Robert");
    });
  });

  describe("user.typing", () => {
    it("returns typing rebase shape", () => {
      const result = mapEventToRebase(
        makeEnvelope("user.typing", {
          userId: "user-2",
          username: "bob",
          firstName: "Bob",
          chatId: "ch-1",
          expiresAt: 9999,
        }),
      );

      expect(result).not.toBeNull();
      expect(result!.typing).toHaveLength(1);
      expect(result!.typing![0].id).toBe("ch-1:user-2");
      expect(result!.typing![0].userId).toBe("user-2");
      expect(result!.typing![0].username).toBe("bob");
      expect(result!.typing![0].firstName).toBe("Bob");
      expect(result!.typing![0].expiresAt).toBe(9999);
    });

    it("returns null when required fields are missing", () => {
      const result = mapEventToRebase(
        makeEnvelope("user.typing", { userId: "user-2" }),
      );
      expect(result).toBeNull();
    });
  });

  describe("user.presence", () => {
    it("returns presence rebase shape", () => {
      const result = mapEventToRebase(
        makeEnvelope("user.presence", {
          userId: "user-2",
          status: "online",
        }),
      );

      expect(result).not.toBeNull();
      expect(result!.presence).toHaveLength(1);
      expect(result!.presence![0].id).toBe("user-2");
      expect(result!.presence![0].userId).toBe("user-2");
      expect(result!.presence![0].status).toBe("online");
      expect(result!.presence![0].lastSeenAt).toBeGreaterThan(0);
    });

    it("handles away status", () => {
      const result = mapEventToRebase(
        makeEnvelope("user.presence", {
          userId: "user-3",
          status: "away",
        }),
      );

      expect(result).not.toBeNull();
      expect(result!.presence![0].status).toBe("away");
    });

    it("returns null when required fields are missing", () => {
      const result = mapEventToRebase(
        makeEnvelope("user.presence", { userId: "user-2" }),
      );
      expect(result).toBeNull();
    });

    it("returns null when userId is missing", () => {
      const result = mapEventToRebase(
        makeEnvelope("user.presence", { status: "online" }),
      );
      expect(result).toBeNull();
    });
  });

  describe("unknown event", () => {
    it("returns null for unrecognized event types", () => {
      const result = mapEventToRebase(
        makeEnvelope("some.unknown.event", { data: 123 }),
      );
      expect(result).toBeNull();
    });
  });
});
