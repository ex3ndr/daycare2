import { describe, it, expect } from "vitest";
import { messageGroupCheck } from "./messageGroupCheck";
import type { MessageData } from "@/app/components/messages/MessageRow";

function makeMessage(overrides: Partial<MessageData> & { senderId?: string } = {}): MessageData {
  const senderId = overrides.senderId ?? "user-1";
  return {
    id: "msg-1",
    text: "hello",
    createdAt: 1000000,
    editedAt: null,
    deletedAt: null,
    threadReplyCount: 0,
    threadLastReplyAt: null,
    sender: {
      id: senderId,
      kind: "human",
      username: "alice",
      firstName: "Alice",
      lastName: null,
      avatarUrl: null,
    },
    attachments: [],
    reactions: [],
    pending: false,
    ...overrides,
    // re-apply sender if senderId was used
    ...(overrides.senderId && !overrides.sender
      ? { sender: { id: senderId, kind: "human", username: "alice", firstName: "Alice", lastName: null, avatarUrl: null } }
      : {}),
  };
}

describe("messageGroupCheck", () => {
  it("returns false when there is no previous message", () => {
    expect(messageGroupCheck(undefined, makeMessage())).toBe(false);
  });

  it("returns true for consecutive messages from the same sender within 5 minutes", () => {
    const prev = makeMessage({ createdAt: 1000000 });
    const current = makeMessage({ createdAt: 1000000 + 60_000 });
    expect(messageGroupCheck(prev, current)).toBe(true);
  });

  it("returns false when senders differ", () => {
    const prev = makeMessage({ senderId: "user-1", createdAt: 1000000 });
    const current = makeMessage({ senderId: "user-2", createdAt: 1000000 + 60_000 });
    expect(messageGroupCheck(prev, current)).toBe(false);
  });

  it("returns false when gap exceeds 5 minutes", () => {
    const prev = makeMessage({ createdAt: 1000000 });
    const current = makeMessage({ createdAt: 1000000 + 5 * 60 * 1000 });
    expect(messageGroupCheck(prev, current)).toBe(false);
  });

  it("returns true when gap is just under 5 minutes", () => {
    const prev = makeMessage({ createdAt: 1000000 });
    const current = makeMessage({ createdAt: 1000000 + 5 * 60 * 1000 - 1 });
    expect(messageGroupCheck(prev, current)).toBe(true);
  });

  it("returns false when previous message was deleted", () => {
    const prev = makeMessage({ createdAt: 1000000, deletedAt: 1000001 });
    const current = makeMessage({ createdAt: 1000000 + 60_000 });
    expect(messageGroupCheck(prev, current)).toBe(false);
  });

  it("returns false when previous message has thread replies", () => {
    const prev = makeMessage({ createdAt: 1000000, threadReplyCount: 3 });
    const current = makeMessage({ createdAt: 1000000 + 60_000 });
    expect(messageGroupCheck(prev, current)).toBe(false);
  });

  it("groups correctly when previous message has no thread replies", () => {
    const prev = makeMessage({ createdAt: 1000000, threadReplyCount: 0 });
    const current = makeMessage({ createdAt: 1000000 + 60_000 });
    expect(messageGroupCheck(prev, current)).toBe(true);
  });
});
