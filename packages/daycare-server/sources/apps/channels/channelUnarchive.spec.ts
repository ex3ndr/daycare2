import { describe, expect, it, vi } from "vitest";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { channelUnarchive } from "./channelUnarchive.js";

type TransactionRunner<DB extends object> = {
  $transaction: <T>(fn: (tx: DB) => Promise<T>) => Promise<T>;
};

function dbWithTransaction<DB extends object>(db: DB): DB & TransactionRunner<DB> {
  return {
    ...db,
    $transaction: async <T>(fn: (tx: DB) => Promise<T>) => fn(db)
  };
}

describe("channelUnarchive", () => {
  it("unarchives a channel when actor is owner", async () => {
    const context = {
      db: dbWithTransaction({
        chat: {
          findFirst: vi.fn().mockResolvedValue({
            id: "chat-1",
            organizationId: "org-1",
            kind: "CHANNEL",
            archivedAt: new Date("2026-02-11T00:00:00.000Z")
          }),
          update: vi.fn().mockResolvedValue({
            id: "chat-1",
            organizationId: "org-1",
            kind: "CHANNEL",
            archivedAt: null
          })
        },
        chatMember: {
          findFirst: vi.fn().mockResolvedValue({ id: "owner-member", role: "OWNER" }),
          findMany: vi.fn().mockResolvedValue([{ userId: "user-1" }])
        }
      }),
      updates: {
        publishToUsers: vi.fn().mockResolvedValue(undefined)
      }
    } as unknown as ApiContext;

    const channel = await channelUnarchive(context, {
      organizationId: "org-1",
      channelId: "chat-1",
      actorUserId: "user-1"
    });

    expect(channel.archivedAt).toBeNull();
    expect(context.updates.publishToUsers).toHaveBeenCalledWith(["user-1"], "channel.updated", {
      orgId: "org-1",
      channelId: "chat-1"
    });
  });

  it("rejects unarchive when channel is not archived", async () => {
    const context = {
      db: dbWithTransaction({
        chat: {
          findFirst: vi.fn().mockResolvedValue({
            id: "chat-1",
            organizationId: "org-1",
            kind: "CHANNEL",
            archivedAt: null
          })
        },
        chatMember: {
          findFirst: vi.fn()
        }
      })
    } as unknown as ApiContext;

    await expect(channelUnarchive(context, {
      organizationId: "org-1",
      channelId: "chat-1",
      actorUserId: "user-1"
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects unarchive for direct chats", async () => {
    const context = {
      db: dbWithTransaction({
        chat: {
          findFirst: vi.fn().mockResolvedValue(null)
        },
        chatMember: {
          findFirst: vi.fn()
        }
      })
    } as unknown as ApiContext;

    await expect(channelUnarchive(context, {
      organizationId: "org-1",
      channelId: "dm-1",
      actorUserId: "user-1"
    })).rejects.toMatchObject({ statusCode: 404 });
  });
});
