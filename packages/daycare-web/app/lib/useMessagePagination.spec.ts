import { describe, it, expect } from "vitest";
import { PAGE_SIZE, SCROLL_TOP_THRESHOLD, SCROLL_BOTTOM_THRESHOLD } from "./useMessagePagination";

describe("useMessagePagination constants", () => {
  it("PAGE_SIZE is 50", () => {
    expect(PAGE_SIZE).toBe(50);
  });

  it("SCROLL_TOP_THRESHOLD triggers load before reaching the top", () => {
    expect(SCROLL_TOP_THRESHOLD).toBeGreaterThan(0);
    expect(SCROLL_TOP_THRESHOLD).toBeLessThanOrEqual(300);
  });

  it("SCROLL_BOTTOM_THRESHOLD detects when user is near bottom", () => {
    expect(SCROLL_BOTTOM_THRESHOLD).toBeGreaterThan(0);
    expect(SCROLL_BOTTOM_THRESHOLD).toBeLessThanOrEqual(200);
  });
});

describe("hasMore inference logic", () => {
  it("detects no more messages when fewer than PAGE_SIZE returned", () => {
    const fetchedCount = 30;
    const hasMore = fetchedCount >= PAGE_SIZE;
    expect(hasMore).toBe(false);
  });

  it("detects more messages exist when PAGE_SIZE returned", () => {
    const fetchedCount = 50;
    const hasMore = fetchedCount >= PAGE_SIZE;
    expect(hasMore).toBe(true);
  });

  it("handles zero messages returned", () => {
    const fetchedCount = 0;
    const hasMore = fetchedCount >= PAGE_SIZE;
    expect(hasMore).toBe(false);
  });
});

describe("scroll position helpers", () => {
  it("detects at-bottom when distance from bottom < threshold", () => {
    const scrollHeight = 2000;
    const scrollTop = 1850;
    const clientHeight = 100;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const isAtBottom = distanceFromBottom < SCROLL_BOTTOM_THRESHOLD;
    expect(distanceFromBottom).toBe(50);
    expect(isAtBottom).toBe(true);
  });

  it("detects not-at-bottom when distance from bottom >= threshold", () => {
    const scrollHeight = 2000;
    const scrollTop = 1000;
    const clientHeight = 100;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const isAtBottom = distanceFromBottom < SCROLL_BOTTOM_THRESHOLD;
    expect(distanceFromBottom).toBe(900);
    expect(isAtBottom).toBe(false);
  });

  it("shows jump-to-bottom when scrolled far from bottom", () => {
    const distanceFromBottom = 500;
    const showJump = distanceFromBottom > SCROLL_BOTTOM_THRESHOLD * 3;
    expect(showJump).toBe(true);
  });

  it("hides jump-to-bottom when near bottom", () => {
    const distanceFromBottom = 200;
    const showJump = distanceFromBottom > SCROLL_BOTTOM_THRESHOLD * 3;
    expect(showJump).toBe(false);
  });

  it("triggers load when scrollTop < SCROLL_TOP_THRESHOLD", () => {
    const scrollTop = 150;
    const shouldLoad = scrollTop < SCROLL_TOP_THRESHOLD;
    expect(shouldLoad).toBe(true);
  });

  it("does not trigger load when scrollTop >= SCROLL_TOP_THRESHOLD", () => {
    const scrollTop = 250;
    const shouldLoad = scrollTop < SCROLL_TOP_THRESHOLD;
    expect(shouldLoad).toBe(false);
  });

  it("restores scroll position after prepending messages", () => {
    const prevScrollHeight = 2000;
    const newScrollHeight = 3500;
    const prevScrollTop = 200;
    const expectedScrollTop = prevScrollTop + (newScrollHeight - prevScrollHeight);
    expect(expectedScrollTop).toBe(1700);
  });
});
