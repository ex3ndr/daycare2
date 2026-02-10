import type { ApiContext } from "./apiContext.js";
import { describe, expect, it, vi } from "vitest";
import { chatRecipientIdsResolve } from "./chatRecipientIdsResolve.js";

describe("chatRecipientIdsResolve", () => {
  it("returns user ids for active chat members", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { userId: "u1" },
      { userId: "u2" }
    ]);
    const context = {
      db: {
        chatMember: {
          findMany
        }
      }
    } as unknown as ApiContext;

    const result = await chatRecipientIdsResolve(context, "chat-1");

    expect(result).toEqual(["u1", "u2"]);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        chatId: "chat-1",
        leftAt: null
      },
      select: {
        userId: true
      }
    });
  });
});
