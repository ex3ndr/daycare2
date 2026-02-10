import type { ChatMember } from "@prisma/client";
import type { ApiContext } from "./apiContext.js";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "./apiError.js";
import { chatMembershipEnsure } from "./chatMembershipEnsure.js";

function membershipCreate(): ChatMember {
  return {
    id: "cm-1",
    chatId: "chat-1",
    userId: "u1",
    role: "OWNER",
    notificationLevel: "ALL",
    muteForever: false,
    muteUntil: null,
    lastReadAt: null,
    joinedAt: new Date("2026-01-01T00:00:00.000Z"),
    leftAt: null
  };
}

describe("chatMembershipEnsure", () => {
  it("returns membership when user belongs to chat", async () => {
    const membership = membershipCreate();
    const findFirst = vi.fn().mockResolvedValue(membership);
    const context = {
      db: {
        chatMember: {
          findFirst
        }
      }
    } as unknown as ApiContext;

    await expect(chatMembershipEnsure(context, "chat-1", "u1")).resolves.toEqual(membership);
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        chatId: "chat-1",
        userId: "u1",
        leftAt: null
      }
    });
  });

  it("throws forbidden when membership is absent", async () => {
    const context = {
      db: {
        chatMember: {
          findFirst: vi.fn().mockResolvedValue(null)
        }
      }
    } as unknown as ApiContext;

    await expect(chatMembershipEnsure(context, "chat-1", "u1")).rejects.toBeInstanceOf(ApiError);
    await expect(chatMembershipEnsure(context, "chat-1", "u1")).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN"
    });
  });
});
