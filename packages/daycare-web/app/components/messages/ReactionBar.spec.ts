import { describe, it, expect } from "vitest";
import { groupReactions } from "./ReactionBar";

const makeReaction = (userId: string, shortcode: string, id?: string) => ({
  id: id ?? `${userId}-${shortcode}`,
  userId,
  shortcode,
  createdAt: Date.now(),
});

describe("groupReactions", () => {
  it("returns empty map for no reactions", () => {
    const result = groupReactions([], "user-1");
    expect(result.size).toBe(0);
  });

  it("groups a single reaction", () => {
    const reactions = [makeReaction("user-1", ":fire:")];
    const result = groupReactions(reactions, "user-1");

    expect(result.size).toBe(1);
    const fire = result.get(":fire:");
    expect(fire).toEqual({ count: 1, userReacted: true });
  });

  it("counts multiple reactions of the same shortcode", () => {
    const reactions = [
      makeReaction("user-1", ":fire:"),
      makeReaction("user-2", ":fire:"),
      makeReaction("user-3", ":fire:"),
    ];
    const result = groupReactions(reactions, "user-1");

    expect(result.size).toBe(1);
    const fire = result.get(":fire:");
    expect(fire).toEqual({ count: 3, userReacted: true });
  });

  it("separates different shortcodes", () => {
    const reactions = [
      makeReaction("user-1", ":fire:"),
      makeReaction("user-2", ":heart:"),
      makeReaction("user-3", ":fire:"),
    ];
    const result = groupReactions(reactions, "user-1");

    expect(result.size).toBe(2);
    expect(result.get(":fire:")).toEqual({ count: 2, userReacted: true });
    expect(result.get(":heart:")).toEqual({ count: 1, userReacted: false });
  });

  it("marks userReacted false when current user has not reacted", () => {
    const reactions = [
      makeReaction("user-2", ":fire:"),
      makeReaction("user-3", ":fire:"),
    ];
    const result = groupReactions(reactions, "user-1");

    const fire = result.get(":fire:");
    expect(fire).toEqual({ count: 2, userReacted: false });
  });

  it("handles multiple shortcodes with mixed user participation", () => {
    const reactions = [
      makeReaction("user-1", ":fire:"),
      makeReaction("user-2", ":fire:"),
      makeReaction("user-1", ":heart:"),
      makeReaction("user-3", ":rocket:"),
    ];
    const result = groupReactions(reactions, "user-1");

    expect(result.size).toBe(3);
    expect(result.get(":fire:")).toEqual({ count: 2, userReacted: true });
    expect(result.get(":heart:")).toEqual({ count: 1, userReacted: true });
    expect(result.get(":rocket:")).toEqual({ count: 1, userReacted: false });
  });
});
