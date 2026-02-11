import { describe, it, expect } from "vitest";
import { typingTextFormat } from "./typingTextFormat";

describe("typingTextFormat", () => {
  it("returns null for empty array", () => {
    expect(typingTextFormat([])).toBeNull();
  });

  it("formats single user", () => {
    expect(typingTextFormat([{ firstName: "Alice" }])).toBe(
      "Alice is typing...",
    );
  });

  it("formats two users", () => {
    expect(
      typingTextFormat([{ firstName: "Alice" }, { firstName: "Bob" }]),
    ).toBe("Alice and Bob are typing...");
  });

  it("formats three or more users", () => {
    expect(
      typingTextFormat([
        { firstName: "Alice" },
        { firstName: "Bob" },
        { firstName: "Charlie" },
      ]),
    ).toBe("Alice and 2 others are typing...");
  });

  it("formats four users", () => {
    expect(
      typingTextFormat([
        { firstName: "Alice" },
        { firstName: "Bob" },
        { firstName: "Charlie" },
        { firstName: "Dave" },
      ]),
    ).toBe("Alice and 3 others are typing...");
  });
});
