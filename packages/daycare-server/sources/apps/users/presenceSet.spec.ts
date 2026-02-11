import { describe, expect, it, vi } from "vitest";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { presenceSet } from "./presenceSet.js";

describe("presenceSet", () => {
  it("sets online presence with ttl and publishes event", async () => {
    const context = {
      redis: {
        set: vi.fn().mockResolvedValue("OK")
      },
      db: {
        user: {
          findMany: vi.fn().mockResolvedValue([{ id: "user-1" }, { id: "user-2" }])
        }
      },
      updates: {
        publishToUsers: vi.fn().mockResolvedValue(undefined)
      }
    } as unknown as ApiContext;

    const status = await presenceSet(context, {
      organizationId: "org-1",
      userId: "user-1",
      status: "online"
    });

    expect(status).toBe("online");
    expect(context.redis.set).toHaveBeenCalledWith("presence:org-1:user-1", "online", "EX", 90);
    expect(context.updates.publishToUsers).toHaveBeenCalledWith(["user-1", "user-2"], "user.presence", {
      orgId: "org-1",
      userId: "user-1",
      status: "online"
    });
  });

  it("sets away presence with ttl", async () => {
    const context = {
      redis: {
        set: vi.fn().mockResolvedValue("OK")
      },
      db: {
        user: {
          findMany: vi.fn().mockResolvedValue([{ id: "user-1" }])
        }
      },
      updates: {
        publishToUsers: vi.fn().mockResolvedValue(undefined)
      }
    } as unknown as ApiContext;

    const status = await presenceSet(context, {
      organizationId: "org-1",
      userId: "user-1",
      status: "away"
    });

    expect(status).toBe("away");
    expect(context.redis.set).toHaveBeenCalledWith("presence:org-1:user-1", "away", "EX", 90);
  });
});
