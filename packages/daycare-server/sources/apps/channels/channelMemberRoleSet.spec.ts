import { describe, expect, it, vi } from "vitest";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { channelMemberRoleSet } from "./channelMemberRoleSet.js";

type TransactionRunner<DB extends object> = {
  $transaction: <T>(fn: (tx: DB) => Promise<T>) => Promise<T>;
};

function dbWithTransaction<DB extends object>(db: DB): DB & TransactionRunner<DB> {
  return {
    ...db,
    $transaction: async <T>(fn: (tx: DB) => Promise<T>) => fn(db)
  };
}

describe("channelMemberRoleSet", () => {
  it("promotes a member to owner", async () => {
    const context = {
      db: dbWithTransaction({
        chat: {
          findFirst: vi.fn().mockResolvedValue({ id: "chat-1" })
        },
        chatMember: {
          findFirst: vi.fn()
            .mockResolvedValueOnce({ id: "owner-member", role: "OWNER" })
            .mockResolvedValueOnce({ id: "target-member", role: "MEMBER" }),
          findMany: vi.fn().mockResolvedValue([{ userId: "user-1" }, { userId: "user-2" }]),
          count: vi.fn().mockResolvedValue(2),
          update: vi.fn().mockResolvedValue({
            id: "target-member",
            chatId: "chat-1",
            userId: "user-2",
            role: "OWNER",
            notificationLevel: "ALL",
            joinedAt: new Date("2026-02-11T00:00:00.000Z"),
            leftAt: null
          })
        }
      }),
      updates: {
        publishToUsers: vi.fn().mockResolvedValue(undefined)
      }
    } as unknown as ApiContext;

    const membership = await channelMemberRoleSet(context, {
      organizationId: "org-1",
      channelId: "chat-1",
      actorUserId: "user-1",
      targetUserId: "user-2",
      role: "OWNER"
    });

    expect(membership.role).toBe("OWNER");
    expect(context.updates.publishToUsers).toHaveBeenCalledWith(["user-1", "user-2"], "channel.member.updated", {
      orgId: "org-1",
      channelId: "chat-1",
      userId: "user-2",
      role: "owner"
    });
  });

  it("demotes an owner when there is another owner", async () => {
    const context = {
      db: dbWithTransaction({
        chat: {
          findFirst: vi.fn().mockResolvedValue({ id: "chat-1" })
        },
        chatMember: {
          findFirst: vi.fn()
            .mockResolvedValueOnce({ id: "owner-member", role: "OWNER" })
            .mockResolvedValueOnce({ id: "target-member", role: "OWNER" }),
          count: vi.fn().mockResolvedValue(2),
          findMany: vi.fn().mockResolvedValue([{ userId: "user-1" }, { userId: "user-2" }]),
          update: vi.fn().mockResolvedValue({
            id: "target-member",
            chatId: "chat-1",
            userId: "user-2",
            role: "MEMBER",
            notificationLevel: "ALL",
            joinedAt: new Date("2026-02-11T00:00:00.000Z"),
            leftAt: null
          })
        }
      }),
      updates: {
        publishToUsers: vi.fn().mockResolvedValue(undefined)
      }
    } as unknown as ApiContext;

    const membership = await channelMemberRoleSet(context, {
      organizationId: "org-1",
      channelId: "chat-1",
      actorUserId: "user-1",
      targetUserId: "user-2",
      role: "MEMBER"
    });

    expect(membership.role).toBe("MEMBER");
  });

  it("rejects role change when actor is not owner", async () => {
    const context = {
      db: dbWithTransaction({
        chat: {
          findFirst: vi.fn().mockResolvedValue({ id: "chat-1" })
        },
        chatMember: {
          findFirst: vi.fn().mockResolvedValue({ id: "member-1", role: "MEMBER" })
        }
      })
    } as unknown as ApiContext;

    await expect(channelMemberRoleSet(context, {
      organizationId: "org-1",
      channelId: "chat-1",
      actorUserId: "user-1",
      targetUserId: "user-2",
      role: "OWNER"
    })).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rejects self role changes", async () => {
    const context = {
      db: dbWithTransaction({
        chat: { findFirst: vi.fn() },
        chatMember: { findFirst: vi.fn(), update: vi.fn(), count: vi.fn() }
      })
    } as unknown as ApiContext;

    await expect(channelMemberRoleSet(context, {
      organizationId: "org-1",
      channelId: "chat-1",
      actorUserId: "user-1",
      targetUserId: "user-1",
      role: "OWNER"
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects demoting the last owner", async () => {
    const context = {
      db: dbWithTransaction({
        chat: {
          findFirst: vi.fn().mockResolvedValue({ id: "chat-1" })
        },
        chatMember: {
          findFirst: vi.fn()
            .mockResolvedValueOnce({ id: "owner-member", role: "OWNER" })
            .mockResolvedValueOnce({ id: "target-owner", role: "OWNER" }),
          count: vi.fn().mockResolvedValue(1),
          update: vi.fn()
        }
      })
    } as unknown as ApiContext;

    await expect(channelMemberRoleSet(context, {
      organizationId: "org-1",
      channelId: "chat-1",
      actorUserId: "user-1",
      targetUserId: "user-2",
      role: "MEMBER"
    })).rejects.toMatchObject({ statusCode: 400 });
  });
});
