import { describe, expect, it, vi } from "vitest";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { presenceHeartbeat } from "./presenceHeartbeat.js";

describe("presenceHeartbeat", () => {
  it("refreshes ttl for existing online presence", async () => {
    const context = {
      redis: {
        get: vi.fn().mockResolvedValue("online"),
        set: vi.fn().mockResolvedValue("OK")
      },
      db: {
        user: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 })
        }
      }
    } as unknown as ApiContext;

    const status = await presenceHeartbeat(context, {
      organizationId: "org-1",
      userId: "user-1"
    });

    expect(status).toBe("online");
    expect(context.redis.set).toHaveBeenCalledWith("presence:org-1:user-1", "online", "EX", 90);
    expect(context.db.user.updateMany).toHaveBeenCalledTimes(1);
  });

  it("returns offline when no active presence key exists", async () => {
    const context = {
      redis: {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn()
      },
      db: {
        user: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 })
        }
      }
    } as unknown as ApiContext;

    const status = await presenceHeartbeat(context, {
      organizationId: "org-1",
      userId: "user-1"
    });

    expect(status).toBe("offline");
    expect(context.redis.set).not.toHaveBeenCalled();
    expect(context.db.user.updateMany).toHaveBeenCalledTimes(1);
  });
});
