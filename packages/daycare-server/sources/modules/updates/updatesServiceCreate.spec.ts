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
});
