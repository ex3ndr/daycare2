import { describe, expect, it, vi } from "vitest";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { presenceGet } from "./presenceGet.js";

describe("presenceGet", () => {
  it("returns offline for missing users and status for active users", async () => {
    const context = {
      redis: {
        mget: vi.fn().mockResolvedValue(["online", null, "away"])
      }
    } as unknown as ApiContext;

    const result = await presenceGet(context, {
      organizationId: "org-1",
      userIds: ["user-1", "user-2", "user-3"]
    });

    expect(context.redis.mget).toHaveBeenCalledWith(
      "presence:org-1:user-1",
      "presence:org-1:user-2",
      "presence:org-1:user-3"
    );
    expect(result).toEqual([
      { userId: "user-1", status: "online" },
      { userId: "user-2", status: "offline" },
      { userId: "user-3", status: "away" }
    ]);
  });

  it("returns empty result when no users are requested", async () => {
    const context = {
      redis: {
        mget: vi.fn()
      }
    } as unknown as ApiContext;

    const result = await presenceGet(context, {
      organizationId: "org-1",
      userIds: []
    });

    expect(result).toEqual([]);
    expect(context.redis.mget).not.toHaveBeenCalled();
  });
});
