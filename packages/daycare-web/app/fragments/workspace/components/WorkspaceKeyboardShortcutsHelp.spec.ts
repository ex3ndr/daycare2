import { describe, it, expect } from "vitest";
import { shortcuts } from "./WorkspaceKeyboardShortcutsHelp";

describe("WorkspaceKeyboardShortcutsHelp", () => {
  it("should define all required keyboard shortcuts", () => {
    const descriptions = shortcuts.map((s) => s.description);
    expect(descriptions).toContain("Send message");
    expect(descriptions).toContain("New line");
    expect(descriptions).toContain("Open search");
    expect(descriptions).toContain("Close thread / modal / search");
    expect(descriptions).toContain("Edit last message (empty composer)");
    expect(descriptions).toContain("Keyboard shortcuts");
    expect(shortcuts).toHaveLength(6);
  });

  it("every shortcut has at least one key", () => {
    for (const s of shortcuts) {
      expect(s.keys.length).toBeGreaterThan(0);
    }
  });
});
