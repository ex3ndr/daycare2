import { describe, expect, it, vi } from "vitest";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { channelMemberKick } from "./channelMemberKick.js";

type TransactionRunner<DB extends object> = {
  $transaction: <T>(fn: (tx: DB) => Promise<T>) => Promise<T>;
};

function dbWithTransaction<DB extends object>(db: DB): DB & TransactionRunner<DB> {
  return {
    ...db,
    $transaction: async <T>(fn: (tx: DB) => Promise<T>) => fn(db)
  };
}

describe("channelMemberKick", () => {
  it("kicks a member when actor is channel owner", async () => {
    const context = {
      db: dbWithTransaction({
        chat: {
          findFirst: vi.fn().mockResolvedValue({ id: "chat-1" })
        },
        chatMember: {
          findFirst: vi.fn()
            .mockResolvedValueOnce({ id: "owner-member", role: "OWNER" })
            .mockResolvedValueOnce({ id: "target-member", role: "MEMBER", leftAt: null }),
          findMany: vi.fn().mockResolvedValue([{ userId: "user-1" }, { userId: "user-3" }]),
          update: vi.fn().mockResolvedValue({
            id: "target-member",
            chatId: "chat-1",
            userId: "user-2",
            role: "MEMBER",
            notificationLevel: "ALL",
            joinedAt: new Date("2026-02-11T00:00:00.000Z"),
            leftAt: new Date("2026-02-11T00:01:00.000Z")
          })
        }
      }),
      updates: {
        publishToUsers: vi.fn().mockResolvedValue(undefined)
      }
    } as unknown as ApiContext;

    const membership = await channelMemberKick(context, {
      organizationId: "org-1",
      channelId: "chat-1",
      actorUserId: "user-1",
      targetUserId: "user-2"
    });

    expect(membership.userId).toBe("user-2");
    expect(context.updates.publishToUsers).toHaveBeenCalledWith(
      ["user-1", "user-3", "user-2"],
      "channel.member.left",
      {
        orgId: "org-1",
        channelId: "chat-1",
        userId: "user-2"
      }
    );
  });

  it("rejects kick when actor is not owner", async () => {
    const context = {
      db: dbWithTransaction({
        chat: {
          findFirst: vi.fn().mockResolvedValue({ id: "chat-1" })
        },
        chatMember: {
          findFirst: vi.fn().mockResolvedValue({ id: "actor-member", role: "MEMBER" })
        }
      })
    } as unknown as ApiContext;

    await expect(channelMemberKick(context, {
      organizationId: "org-1",
      channelId: "chat-1",
      actorUserId: "user-1",
      targetUserId: "user-2"
    })).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rejects self kick", async () => {
    const context = {
      db: dbWithTransaction({
        chat: { findFirst: vi.fn() },
        chatMember: { findFirst: vi.fn(), update: vi.fn() }
      })
    } as unknown as ApiContext;

    await expect(channelMemberKick(context, {
      organizationId: "org-1",
      channelId: "chat-1",
      actorUserId: "user-1",
      targetUserId: "user-1"
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects kick when member already left", async () => {
    const context = {
      db: dbWithTransaction({
        chat: {
          findFirst: vi.fn().mockResolvedValue({ id: "chat-1" })
        },
        chatMember: {
          findFirst: vi.fn()
            .mockResolvedValueOnce({ id: "owner-member", role: "OWNER" })
            .mockResolvedValueOnce(null)
        }
      })
    } as unknown as ApiContext;

    await expect(channelMemberKick(context, {
      organizationId: "org-1",
      channelId: "chat-1",
      actorUserId: "user-1",
      targetUserId: "user-2"
    })).rejects.toMatchObject({ statusCode: 404 });
  });

  it("rejects kick when target member is an owner", async () => {
    const context = {
      db: dbWithTransaction({
        chat: {
          findFirst: vi.fn().mockResolvedValue({ id: "chat-1" })
        },
        chatMember: {
          findFirst: vi.fn()
            .mockResolvedValueOnce({ id: "owner-member", role: "OWNER" })
            .mockResolvedValueOnce({ id: "target-owner", role: "OWNER" })
        }
      })
    } as unknown as ApiContext;

    await expect(channelMemberKick(context, {
      organizationId: "org-1",
      channelId: "chat-1",
      actorUserId: "user-1",
      targetUserId: "user-2"
    })).rejects.toMatchObject({ statusCode: 403 });
  });
});
