import { describe, expect, it, vi } from "vitest";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { ApiError } from "@/apps/api/lib/apiError.js";
import { directCreate } from "./directCreate.js";

type TransactionRunner<DB extends object> = {
  $transaction: <T>(fn: (tx: DB) => Promise<T>) => Promise<T>;
};

function dbWithTransaction<DB extends object>(db: DB): DB & TransactionRunner<DB> {
  return {
    ...db,
    $transaction: async <T>(fn: (tx: DB) => Promise<T>) => fn(db)
  };
}

describe("directCreate", () => {
  it("creates a direct chat and adds both members", async () => {
    const chatMemberFindUnique = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    const chatMemberCreate = vi.fn().mockResolvedValue({ id: "member-1" });
    const chatMemberUpdate = vi.fn().mockResolvedValue({ id: "member-1" });
    const chatFindUnique = vi.fn().mockResolvedValue(null);
    const chatCreate = vi.fn().mockResolvedValue({
      id: "chat-1",
      organizationId: "org-1",
      createdByUserId: "user-1",
      kind: "DIRECT",
      visibility: "PRIVATE",
      directKey: "user-1:user-2",
      name: null,
      topic: null,
      createdAt: new Date("2026-02-11T00:00:00.000Z"),
      updatedAt: new Date("2026-02-11T00:00:00.000Z"),
      archivedAt: null
    });

    const context = {
      db: dbWithTransaction({
        user: {
          findFirst: vi.fn().mockResolvedValue({ id: "user-2" })
        },
        chat: {
          findUnique: chatFindUnique,
          create: chatCreate
        },
        chatMember: {
          findUnique: chatMemberFindUnique,
          create: chatMemberCreate,
          update: chatMemberUpdate
        }
      }),
      updates: {
        publishToUsers: vi.fn().mockResolvedValue(undefined)
      }
    } as unknown as ApiContext;

    const direct = await directCreate(context, {
      organizationId: "org-1",
      userId: "user-2",
      peerUserId: "user-1"
    });

    expect(direct.id).toBe("chat-1");
    expect(chatFindUnique).toHaveBeenCalledWith({
      where: {
        directKey: "user-1:user-2"
      }
    });
    expect(chatCreate).toHaveBeenCalledTimes(1);
    expect(chatMemberCreate).toHaveBeenCalledTimes(2);
    expect(chatMemberUpdate).not.toHaveBeenCalled();
    expect(context.updates.publishToUsers).toHaveBeenCalledWith(
      ["user-2", "user-1"],
      "channel.created",
      { orgId: "org-1", channelId: "chat-1" }
    );
  });

  it("returns the existing direct chat and reactivates left members", async () => {
    const chatMemberFindUnique = vi.fn()
      .mockResolvedValueOnce({
        id: "member-1",
        leftAt: null
      })
      .mockResolvedValueOnce({
        id: "member-2",
        leftAt: new Date("2026-02-10T00:00:00.000Z")
      });
    const chatMemberCreate = vi.fn().mockResolvedValue({ id: "member-3" });
    const chatMemberUpdate = vi.fn().mockResolvedValue({ id: "member-2" });

    const context = {
      db: dbWithTransaction({
        user: {
          findFirst: vi.fn().mockResolvedValue({ id: "user-2" })
        },
        chat: {
          findUnique: vi.fn().mockResolvedValue({
            id: "chat-1",
            organizationId: "org-1",
            createdByUserId: "user-1",
            kind: "DIRECT",
            visibility: "PRIVATE",
            directKey: "user-1:user-2",
            name: null,
            topic: null,
            createdAt: new Date("2026-02-11T00:00:00.000Z"),
            updatedAt: new Date("2026-02-11T00:00:00.000Z"),
            archivedAt: null
          }),
          create: vi.fn().mockResolvedValue(null)
        },
        chatMember: {
          findUnique: chatMemberFindUnique,
          create: chatMemberCreate,
          update: chatMemberUpdate
        }
      }),
      updates: {
        publishToUsers: vi.fn().mockResolvedValue(undefined)
      }
    } as unknown as ApiContext;

    const direct = await directCreate(context, {
      organizationId: "org-1",
      userId: "user-1",
      peerUserId: "user-2"
    });

    expect(direct.id).toBe("chat-1");
    expect(chatMemberCreate).not.toHaveBeenCalled();
    expect(chatMemberUpdate).toHaveBeenCalledTimes(1);
  });

  it("rejects self direct chats", async () => {
    const context = {
      db: dbWithTransaction({
        user: { findFirst: vi.fn() },
        chat: { findUnique: vi.fn(), create: vi.fn() },
        chatMember: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() }
      }),
      updates: {
        publishToUsers: vi.fn()
      }
    } as unknown as ApiContext;

    await expect(directCreate(context, {
      organizationId: "org-1",
      userId: "user-1",
      peerUserId: "user-1"
    })).rejects.toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR"
    } satisfies Partial<ApiError>);
  });
});
