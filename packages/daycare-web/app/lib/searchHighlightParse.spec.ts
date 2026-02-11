import { describe, it, expect } from "vitest";
import { searchHighlightParse } from "./searchHighlightParse";

describe("searchHighlightParse", () => {
  it("returns single plain segment for text with no markers", () => {
    expect(searchHighlightParse("hello world")).toEqual([
      { text: "hello world", highlighted: false },
    ]);
  });

  it("parses a single highlighted term", () => {
    expect(searchHighlightParse("hello [[world]] today")).toEqual([
      { text: "hello ", highlighted: false },
      { text: "world", highlighted: true },
      { text: " today", highlighted: false },
    ]);
  });

  it("parses multiple highlighted terms", () => {
    expect(
      searchHighlightParse("[[hello]] world [[today]]"),
    ).toEqual([
      { text: "hello", highlighted: true },
      { text: " world ", highlighted: false },
      { text: "today", highlighted: true },
    ]);
  });

  it("parses highlight at start", () => {
    expect(searchHighlightParse("[[start]] of text")).toEqual([
      { text: "start", highlighted: true },
      { text: " of text", highlighted: false },
    ]);
  });

  it("parses highlight at end", () => {
    expect(searchHighlightParse("text at [[end]]")).toEqual([
      { text: "text at ", highlighted: false },
      { text: "end", highlighted: true },
    ]);
  });

  it("handles adjacent highlighted terms", () => {
    expect(searchHighlightParse("[[one]][[two]]")).toEqual([
      { text: "one", highlighted: true },
      { text: "two", highlighted: true },
    ]);
  });

  it("handles empty string", () => {
    expect(searchHighlightParse("")).toEqual([]);
  });

  it("handles malformed: opening marker without closing", () => {
    expect(searchHighlightParse("text [[broken marker")).toEqual([
      { text: "text ", highlighted: false },
      { text: "[[broken marker", highlighted: false },
    ]);
  });

  it("handles entirely highlighted text", () => {
    expect(searchHighlightParse("[[everything]]")).toEqual([
      { text: "everything", highlighted: true },
    ]);
  });

  it("handles empty highlight markers", () => {
    expect(searchHighlightParse("before [[]] after")).toEqual([
      { text: "before ", highlighted: false },
      { text: "", highlighted: true },
      { text: " after", highlighted: false },
    ]);
  });
});
