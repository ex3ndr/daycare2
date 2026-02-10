import type { ApiContext } from "./apiContext.js";
import { describe, expect, it, vi } from "vitest";
import { organizationRecipientIdsResolve } from "./organizationRecipientIdsResolve.js";

describe("organizationRecipientIdsResolve", () => {
  it("returns all user ids in the organization", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: "u1" },
      { id: "u3" }
    ]);
    const context = {
      db: {
        user: {
          findMany
        }
      }
    } as unknown as ApiContext;

    const result = await organizationRecipientIdsResolve(context, "org-1");

    expect(result).toEqual(["u1", "u3"]);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org-1"
      },
      select: {
        id: true
      }
    });
  });
});
