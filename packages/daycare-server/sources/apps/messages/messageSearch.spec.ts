import { describe, expect, it, vi } from "vitest";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { messageSearch } from "./messageSearch.js";

describe("messageSearch", () => {
  it("returns ranked message search results", async () => {
    const context = {
      db: {
        $queryRaw: vi.fn().mockResolvedValue([{
          id: "m-1",
          chatId: "chat-1",
          senderUserId: "user-1",
          text: "hello daycare",
          highlight: "<b>hello</b> daycare",
          createdAt: new Date("2026-02-11T00:00:00.000Z")
        }])
      }
    } as unknown as ApiContext;

    const result = await messageSearch(context, {
      organizationId: "org-1",
      userId: "user-1",
      query: "hello"
    });

    expect(result).toEqual([{
      id: "m-1",
      chatId: "chat-1",
      senderUserId: "user-1",
      text: "hello daycare",
      highlight: "<b>hello</b> daycare",
      createdAt: new Date("2026-02-11T00:00:00.000Z").getTime()
    }]);
  });

  it("supports channel filters and pagination inputs", async () => {
    const queryRaw = vi.fn().mockResolvedValue([]);
    const context = {
      db: {
        $queryRaw: queryRaw
      }
    } as unknown as ApiContext;

    const result = await messageSearch(context, {
      organizationId: "org-1",
      userId: "user-1",
      query: "hello",
      channelId: "chat-1",
      before: Date.now(),
      limit: 10
    });

    expect(result).toEqual([]);
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it("returns empty results when no matches exist", async () => {
    const context = {
      db: {
        $queryRaw: vi.fn().mockResolvedValue([])
      }
    } as unknown as ApiContext;

    const result = await messageSearch(context, {
      organizationId: "org-1",
      userId: "user-1",
      query: "missing"
    });

    expect(result).toEqual([]);
  });

  it("handles search terms with special characters", async () => {
    const context = {
      db: {
        $queryRaw: vi.fn().mockResolvedValue([])
      }
    } as unknown as ApiContext;

    const result = await messageSearch(context, {
      organizationId: "org-1",
      userId: "user-1",
      query: "@alice + #ops"
    });

    expect(result).toEqual([]);
  });
});
