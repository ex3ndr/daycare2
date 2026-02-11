import type { PrismaClient, UserUpdate } from "@prisma/client";
import type { FastifyReply } from "fastify";
import { describe, expect, it, vi } from "vitest";
import { updatesServiceCreate } from "./updatesServiceCreate.js";

function userUpdateCreate(seqno: number): UserUpdate {
  return {
    id: `upd-${seqno}`,
    userId: "user-1",
    seqno,
    eventType: "message.created",
    payloadJson: {
      messageId: `m-${seqno}`
    },
    createdAt: new Date(1_000 + seqno)
  };
}

function replyCreate(writeSpy: (chunk: string) => void): FastifyReply {
  return {
    raw: {
      writeHead: vi.fn(),
      write: writeSpy
    }
  } as unknown as FastifyReply;
}

describe("updatesServiceCreate", () => {
  it("subscribes and publishes a single update per unique user id", async () => {
    const transaction = vi.fn().mockImplementation(async (callback: (tx: unknown) => Promise<UserUpdate>) => {
      const tx = {
        $executeRaw: vi.fn().mockResolvedValue(undefined),
        userUpdate: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue(userUpdateCreate(1)),
          findMany: vi.fn().mockResolvedValue([]),
          deleteMany: vi.fn().mockResolvedValue({ count: 0 })
        }
      };
      return await callback(tx);
    });

    const db = {
      $transaction: transaction
    } as unknown as PrismaClient;

    const writes: string[] = [];
    const writeSpy = vi.fn((chunk: string) => {
      writes.push(chunk);
    });
    const reply = replyCreate(writeSpy);

    const updates = updatesServiceCreate(db);
    const unsubscribe = updates.subscribe("user-1", "org-1", reply);

    await updates.publishToUsers(["user-1", "user-1"], "message.created", { messageId: "m-1" });

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(writes.some((chunk) => chunk.includes("event: ready"))).toBe(true);
    expect(writes.some((chunk) => chunk.includes("event: update"))).toBe(true);

    unsubscribe();
  });

  it("returns diff envelope with resetRequired when offset is behind retention window", async () => {
    const head = { seqno: 12 };
    const earliest = { seqno: 10 };
    const updates = [userUpdateCreate(11), userUpdateCreate(12)];

    const findFirst = vi.fn().mockImplementation(async (params: { orderBy: { seqno: "asc" | "desc" } }) => {
      if (params.orderBy.seqno === "desc") {
        return head;
      }
      return earliest;
    });

    const db = {
      userUpdate: {
        findFirst,
        findMany: vi.fn().mockResolvedValue(updates)
      }
    } as unknown as PrismaClient;

    const service = updatesServiceCreate(db);
    const result = await service.diffGet("user-1", 5, 100);

    expect(result.headOffset).toBe(12);
    expect(result.resetRequired).toBe(true);
    expect(result.updates).toEqual([
      {
        id: "upd-11",
        userId: "user-1",
        seqno: 11,
        eventType: "message.created",
        payload: {
          messageId: "m-11"
        },
        createdAt: 1011
      },
      {
        id: "upd-12",
        userId: "user-1",
        seqno: 12,
        eventType: "message.created",
        payload: {
          messageId: "m-12"
        },
        createdAt: 1012
      }
    ]);
  });

  it("publishes updates even without active subscribers", async () => {
    const transaction = vi.fn().mockImplementation(async (callback: (tx: unknown) => Promise<UserUpdate>) => {
      const tx = {
        $executeRaw: vi.fn().mockResolvedValue(undefined),
        userUpdate: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue(userUpdateCreate(1)),
          findMany: vi.fn().mockResolvedValue([]),
          deleteMany: vi.fn().mockResolvedValue({ count: 0 })
        }
      };
      return await callback(tx);
    });

    const db = {
      $transaction: transaction
    } as unknown as PrismaClient;

    const service = updatesServiceCreate(db);
    await service.publishToUsers(["user-1"], "message.created", { messageId: "m-1" });

    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it("retries on unique constraint violations and trims old updates", async () => {
    const txCapture: { deleteMany?: () => Promise<{ count: number }> } = {};

    const transaction = vi.fn()
      .mockImplementationOnce(async () => {
        throw new Error("UserUpdate_userId_seqno_key");
      })
      .mockImplementationOnce(async (callback: (tx: unknown) => Promise<UserUpdate>) => {
        const tx = {
          $executeRaw: vi.fn().mockResolvedValue(undefined),
          userUpdate: {
            findFirst: vi.fn().mockResolvedValue({ seqno: 5099 }),
            create: vi.fn().mockResolvedValue(userUpdateCreate(5100)),
            findMany: vi.fn().mockResolvedValue([{ id: "old-1" }]),
            deleteMany: vi.fn().mockResolvedValue({ count: 1 })
          }
        };
        txCapture.deleteMany = tx.userUpdate.deleteMany;
        return await callback(tx);
      });

    const db = {
      $transaction: transaction
    } as unknown as PrismaClient;

    const writes: string[] = [];
    const writeSpy = vi.fn((chunk: string) => {
      writes.push(chunk);
    });
    const reply = replyCreate(writeSpy);

    const service = updatesServiceCreate(db);
    service.subscribe("user-1", "org-1", reply);

    await service.publishToUsers(["user-1"], "message.created", { messageId: "m-5100" });

    expect(transaction).toHaveBeenCalledTimes(2);
    expect(txCapture.deleteMany).toBeDefined();
    expect(writes.some((chunk) => chunk.includes("event: update"))).toBe(true);
  });

  it("returns diff with resetRequired false when no history exists", async () => {
    const db = {
      userUpdate: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([])
      }
    } as unknown as PrismaClient;

    const service = updatesServiceCreate(db);
    const result = await service.diffGet("user-1", 0, 50);

    expect(result.headOffset).toBe(0);
    expect(result.resetRequired).toBe(false);
    expect(result.updates).toEqual([]);
  });

  it("does not deliver message.created updates to muted users", async () => {
    const transaction = vi.fn();
    const db = {
      $transaction: transaction,
      chatMember: {
        findFirst: vi.fn().mockResolvedValue({
          notificationLevel: "MUTED",
          muteForever: true,
          muteUntil: null
        })
      },
      messageMention: {
        findFirst: vi.fn()
      }
    } as unknown as PrismaClient;

    const service = updatesServiceCreate(db);
    await service.publishToUsers(["user-1"], "message.created", {
      orgId: "org-1",
      channelId: "chat-1",
      messageId: "m-1"
    });

    expect(transaction).not.toHaveBeenCalled();
  });

  it("delivers message.created updates for mentions-only members when mentioned", async () => {
    const transaction = vi.fn().mockImplementation(async (callback: (tx: unknown) => Promise<UserUpdate>) => {
      const tx = {
        $executeRaw: vi.fn().mockResolvedValue(undefined),
        userUpdate: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue(userUpdateCreate(1)),
          findMany: vi.fn().mockResolvedValue([]),
          deleteMany: vi.fn().mockResolvedValue({ count: 0 })
        }
      };
      return await callback(tx);
    });

    const db = {
      $transaction: transaction,
      chatMember: {
        findFirst: vi.fn().mockResolvedValue({
          notificationLevel: "MENTIONS_ONLY",
          muteForever: false,
          muteUntil: null
        })
      },
      messageMention: {
        findFirst: vi.fn().mockResolvedValue({ id: "mention-1" })
      }
    } as unknown as PrismaClient;

    const service = updatesServiceCreate(db);
    await service.publishToUsers(["user-1"], "message.created", {
      orgId: "org-1",
      channelId: "chat-1",
      messageId: "m-1"
    });

    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it("does not deliver message.created for muted level without muteUntil", async () => {
    const transaction = vi.fn();
    const db = {
      $transaction: transaction,
      chatMember: {
        findFirst: vi.fn().mockResolvedValue({
          notificationLevel: "MUTED",
          muteForever: false,
          muteUntil: null
        })
      },
      messageMention: {
        findFirst: vi.fn()
      }
    } as unknown as PrismaClient;

    const service = updatesServiceCreate(db);
    await service.publishToUsers(["user-1"], "message.created", {
      orgId: "org-1",
      channelId: "chat-1",
      messageId: "m-1"
    });

    expect(transaction).not.toHaveBeenCalled();
  });
});
