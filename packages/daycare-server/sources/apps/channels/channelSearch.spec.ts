import { describe, expect, it, vi } from "vitest";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { channelSearch } from "./channelSearch.js";

describe("channelSearch", () => {
  it("returns channels matching by name", async () => {
    const context = {
      db: {
        $queryRaw: vi.fn().mockResolvedValue([{
          id: "chat-1",
          organizationId: "org-1",
          name: "general",
          topic: null,
          visibility: "PUBLIC",
          createdAt: new Date("2026-02-11T00:00:00.000Z"),
          updatedAt: new Date("2026-02-11T00:00:00.000Z")
        }])
      }
    } as unknown as ApiContext;

    const result = await channelSearch(context, {
      organizationId: "org-1",
      userId: "user-1",
      query: "general"
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("general");
  });

  it("returns channels matching by topic", async () => {
    const context = {
      db: {
        $queryRaw: vi.fn().mockResolvedValue([{
          id: "chat-2",
          organizationId: "org-1",
          name: "engineering",
          topic: "oncall operations",
          visibility: "PRIVATE",
          createdAt: new Date("2026-02-11T00:00:00.000Z"),
          updatedAt: new Date("2026-02-11T00:00:00.000Z")
        }])
      }
    } as unknown as ApiContext;

    const result = await channelSearch(context, {
      organizationId: "org-1",
      userId: "user-1",
      query: "oncall",
      limit: 5
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.topic).toContain("oncall");
    expect(result[0]?.visibility).toBe("private");
  });

  it("returns empty array when no matches exist", async () => {
    const context = {
      db: {
        $queryRaw: vi.fn().mockResolvedValue([])
      }
    } as unknown as ApiContext;

    const result = await channelSearch(context, {
      organizationId: "org-1",
      userId: "user-1",
      query: "missing"
    });

    expect(result).toEqual([]);
  });
});
