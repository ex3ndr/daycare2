import { describe, it, expect, vi, afterEach } from "vitest";
import { timeFormat } from "./timeFormat";

describe("timeFormat", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows time only for today", () => {
    const now = new Date();
    now.setHours(14, 30, 0, 0);
    const result = timeFormat(now.getTime());
    // Should contain a time string but NOT a date
    expect(result).toMatch(/\d/);
    expect(result).not.toMatch(/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/);
  });

  it("shows 'Yesterday' prefix for yesterday", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(10, 0, 0, 0);
    const result = timeFormat(yesterday.getTime());
    expect(result).toContain("Yesterday");
  });

  it("shows date for older timestamps", () => {
    const oldDate = new Date(2024, 0, 15, 9, 30);
    const result = timeFormat(oldDate.getTime());
    // Should contain month name (Jan)
    expect(result).toMatch(/Jan/);
    expect(result).toMatch(/15/);
  });
});
