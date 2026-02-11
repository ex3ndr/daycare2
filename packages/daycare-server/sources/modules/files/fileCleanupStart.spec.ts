import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/s3/s3ObjectDelete.js", () => ({
  s3ObjectDelete: vi.fn().mockResolvedValue(undefined)
}));

import { s3ObjectDelete } from "@/modules/s3/s3ObjectDelete.js";
import { fileCleanupStart } from "./fileCleanupStart.js";

describe("fileCleanupStart", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("removes expired pending and deleted files from S3 and database", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: "f1", storageKey: "org/user/f1/file.txt" },
      { id: "f2", storageKey: "org/user/f2/file.txt" }
    ]);
    const deleteMany = vi.fn().mockResolvedValue({ count: 2 });

    const db = {
      fileAsset: {
        findMany,
        deleteMany
      }
    } as any;

    const stop = fileCleanupStart(db, {} as any, "daycare", { intervalMs: 1000 });

    await vi.advanceTimersByTimeAsync(1000);

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(s3ObjectDelete).toHaveBeenCalledTimes(2);
    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: ["f1", "f2"]
        }
      }
    });

    stop();
  });

  it("skips deletes when no files are eligible", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const deleteMany = vi.fn().mockResolvedValue({ count: 0 });

    const db = {
      fileAsset: {
        findMany,
        deleteMany
      }
    } as any;

    const stop = fileCleanupStart(db, {} as any, "daycare", { intervalMs: 1000 });

    await vi.advanceTimersByTimeAsync(1000);

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(s3ObjectDelete).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();

    stop();
  });

  it("deletes database rows only for successfully deleted S3 objects", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: "f1", storageKey: "org/user/f1/file.txt" },
      { id: "f2", storageKey: "org/user/f2/file.txt" }
    ]);
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 });

    vi.mocked(s3ObjectDelete)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("s3 down"));

    const db = {
      fileAsset: {
        findMany,
        deleteMany
      }
    } as any;

    const stop = fileCleanupStart(db, {} as any, "daycare", { intervalMs: 1000 });

    await vi.advanceTimersByTimeAsync(1000);

    expect(s3ObjectDelete).toHaveBeenCalledTimes(2);
    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: ["f1"]
        }
      }
    });

    stop();
  });

  it("does not delete database rows when all S3 deletions fail", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: "f1", storageKey: "org/user/f1/file.txt" }
    ]);
    const deleteMany = vi.fn().mockResolvedValue({ count: 0 });

    vi.mocked(s3ObjectDelete).mockRejectedValue(new Error("s3 down"));

    const db = {
      fileAsset: {
        findMany,
        deleteMany
      }
    } as any;

    const stop = fileCleanupStart(db, {} as any, "daycare", { intervalMs: 1000 });

    await vi.advanceTimersByTimeAsync(1000);

    expect(deleteMany).not.toHaveBeenCalled();

    stop();
  });
});
