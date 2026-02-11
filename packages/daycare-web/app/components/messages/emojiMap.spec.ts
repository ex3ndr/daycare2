import { describe, it, expect } from "vitest";
import { emojiMap, pickerEmoji, shortcodeToEmoji } from "./emojiMap";

describe("emojiMap", () => {
  it("maps all expected shortcodes to Unicode emoji", () => {
    expect(emojiMap[":thumbsup:"]).toBe("\u{1F44D}");
    expect(emojiMap[":fire:"]).toBe("\u{1F525}");
    expect(emojiMap[":heart:"]).toBe("\u{2764}\u{FE0F}");
    expect(emojiMap[":laugh:"]).toBe("\u{1F602}");
    expect(emojiMap[":eyes:"]).toBe("\u{1F440}");
    expect(emojiMap[":check:"]).toBe("\u{2705}");
    expect(emojiMap[":clap:"]).toBe("\u{1F44F}");
    expect(emojiMap[":rocket:"]).toBe("\u{1F680}");
    expect(emojiMap[":thinking:"]).toBe("\u{1F914}");
    expect(emojiMap[":100:"]).toBe("\u{1F4AF}");
  });

  it("has exactly 10 emoji entries", () => {
    expect(Object.keys(emojiMap)).toHaveLength(10);
  });
});

describe("pickerEmoji", () => {
  it("returns array of shortcode/emoji pairs matching emojiMap", () => {
    expect(pickerEmoji).toHaveLength(10);
    for (const { shortcode, emoji } of pickerEmoji) {
      expect(emojiMap[shortcode]).toBe(emoji);
    }
  });
});

describe("shortcodeToEmoji", () => {
  it("converts known shortcode to emoji", () => {
    expect(shortcodeToEmoji(":fire:")).toBe("\u{1F525}");
    expect(shortcodeToEmoji(":rocket:")).toBe("\u{1F680}");
  });

  it("returns unknown shortcode as-is", () => {
    expect(shortcodeToEmoji(":unknown:")).toBe(":unknown:");
    expect(shortcodeToEmoji("hello")).toBe("hello");
  });
});
