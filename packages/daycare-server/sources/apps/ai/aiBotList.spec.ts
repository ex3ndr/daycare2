import { describe, expect, it, vi } from "vitest";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { aiBotList } from "./aiBotList.js";

describe("aiBotList", () => {
  it("lists AI users in an organization", async () => {
    const context = {
      db: {
        user: {
          findMany: vi.fn().mockResolvedValue([
            { id: "bot-1", kind: "AI", username: "assistant" }
          ])
        }
      }
    } as unknown as ApiContext;

    const bots = await aiBotList(context, {
      organizationId: "org-1"
    });

    expect(bots).toHaveLength(1);
    expect(bots[0]?.username).toBe("assistant");
  });
});
