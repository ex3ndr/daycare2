import { describe, it, expect } from "vitest";
import { lastEditableMessageFind } from "./lastEditableMessageFind";

function makeMsg(
  id: string,
  senderUserId: string,
  opts?: { deletedAt?: number | null },
) {
  return {
    id,
    senderUserId,
    deletedAt: opts?.deletedAt ?? null,
  };
}

describe("lastEditableMessageFind", () => {
  const userId = "user-1";

  it("returns null for empty messages", () => {
    expect(lastEditableMessageFind([], userId)).toBe(null);
  });

  it("returns the last own message", () => {
    const messages = [
      makeMsg("m1", userId),
      makeMsg("m2", "other-user"),
      makeMsg("m3", userId),
    ];
    expect(lastEditableMessageFind(messages, userId)).toBe("m3");
  });

  it("skips deleted messages", () => {
    const messages = [
      makeMsg("m1", userId),
      makeMsg("m2", userId, { deletedAt: 1000 }),
    ];
    expect(lastEditableMessageFind(messages, userId)).toBe("m1");
  });

  it("returns null when no own messages", () => {
    const messages = [
      makeMsg("m1", "other-user"),
      makeMsg("m2", "another-user"),
    ];
    expect(lastEditableMessageFind(messages, userId)).toBe(null);
  });

  it("returns null when all own messages are deleted", () => {
    const messages = [
      makeMsg("m1", userId, { deletedAt: 1000 }),
      makeMsg("m2", userId, { deletedAt: 2000 }),
    ];
    expect(lastEditableMessageFind(messages, userId)).toBe(null);
  });

  it("picks the last eligible when mixed with other users", () => {
    const messages = [
      makeMsg("m1", userId),
      makeMsg("m2", "other"),
      makeMsg("m3", userId, { deletedAt: 123 }),
      makeMsg("m4", "other"),
      makeMsg("m5", userId),
      makeMsg("m6", "other"),
    ];
    expect(lastEditableMessageFind(messages, userId)).toBe("m5");
  });
});
