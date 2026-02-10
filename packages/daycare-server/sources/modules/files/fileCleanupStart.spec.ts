import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const accessMock = vi.fn();
const rmMock = vi.fn();

vi.mock("node:fs/promises", () => ({
  access: accessMock,
  rm: rmMock
}));

describe("fileCleanupStart", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    accessMock.mockReset();
    rmMock.mockReset();
    accessMock.mockResolvedValue(undefined);
    rmMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("removes expired pending files from disk and database", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: "f1", storageKey: "org/user/f1/file.txt" }
    ]);
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 });

    const db = {
      fileAsset: {
        findMany,
        deleteMany
      }
    } as any;

    const { fileCleanupStart } = await import("./fileCleanupStart.js");
    const stop = fileCleanupStart(db, { intervalMs: 1000 });

    await vi.advanceTimersByTimeAsync(1000);

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(accessMock).toHaveBeenCalledTimes(1);
    expect(rmMock).toHaveBeenCalledTimes(1);
    expect(deleteMany).toHaveBeenCalledTimes(1);

    stop();
  });

  it("skips delete when no files are expired", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const deleteMany = vi.fn().mockResolvedValue({ count: 0 });

    const db = {
      fileAsset: {
        findMany,
        deleteMany
      }
    } as any;

    const { fileCleanupStart } = await import("./fileCleanupStart.js");
    const stop = fileCleanupStart(db, { intervalMs: 1000 });

    await vi.advanceTimersByTimeAsync(1000);

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(deleteMany).not.toHaveBeenCalled();
    expect(rmMock).not.toHaveBeenCalled();

    stop();
  });
});
