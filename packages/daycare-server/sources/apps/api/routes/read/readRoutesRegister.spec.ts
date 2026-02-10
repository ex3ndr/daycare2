import type { FastifyInstance } from "fastify";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/apps/api/lib/authContextResolve.js", () => ({
  authContextResolve: vi.fn()
}));

vi.mock("@/apps/api/lib/chatMembershipEnsure.js", () => ({
  chatMembershipEnsure: vi.fn()
}));

import { authContextResolve } from "@/apps/api/lib/authContextResolve.js";
import { chatMembershipEnsure } from "@/apps/api/lib/chatMembershipEnsure.js";
import { readRoutesRegister } from "./readRoutesRegister.js";

describe("readRoutesRegister", () => {
  it("marks chat as read and returns timestamp", async () => {
    const handlers: Record<string, (request: any, reply: any) => Promise<unknown>> = {};
    const app = {
      post: (path: string, handler: (request: any, reply: any) => Promise<unknown>) => {
        handlers[path] = handler;
      },
      get: (path: string, handler: (request: any, reply: any) => Promise<unknown>) => {
        handlers[path] = handler;
      }
    } as FastifyInstance;

    const update = vi.fn().mockResolvedValue({});
    const context = {
      db: {
        chatMember: {
          update
        },
        message: {
          count: vi.fn()
        }
      }
    } as unknown as ApiContext;

    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "user-1" } as any
    });
    vi.mocked(chatMembershipEnsure).mockResolvedValue({
      id: "membership-1",
      lastReadAt: null
    } as any);

    await readRoutesRegister(app, context);

    const read = handlers["/api/org/:orgid/channels/:channelId/read"];
    if (!read) {
      throw new Error("read handler not registered");
    }
    const result = await read({
      params: {
        orgid: "org-1",
        channelId: "chat-1"
      }
    }, {} as any);

    expect(update).toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: true,
      data: {
        chatId: "chat-1"
      }
    });
  });

  it("returns unread count for read-state", async () => {
    const handlers: Record<string, (request: any, reply: any) => Promise<unknown>> = {};
    const app = {
      post: (path: string, handler: (request: any, reply: any) => Promise<unknown>) => {
        handlers[path] = handler;
      },
      get: (path: string, handler: (request: any, reply: any) => Promise<unknown>) => {
        handlers[path] = handler;
      }
    } as FastifyInstance;

    const count = vi.fn().mockResolvedValue(3);
    const context = {
      db: {
        chatMember: {
          update: vi.fn()
        },
        message: {
          count
        }
      }
    } as unknown as ApiContext;

    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "user-1" } as any
    });
    vi.mocked(chatMembershipEnsure).mockResolvedValue({
      id: "membership-1",
      lastReadAt: new Date("2026-02-10T00:00:00.000Z")
    } as any);

    await readRoutesRegister(app, context);

    const readState = handlers["/api/org/:orgid/channels/:channelId/read-state"];
    if (!readState) {
      throw new Error("read-state handler not registered");
    }
    const result = await readState({
      params: {
        orgid: "org-1",
        channelId: "chat-1"
      }
    }, {} as any);

    expect(count).toHaveBeenCalled();
    expect(result).toEqual({
      ok: true,
      data: {
        chatId: "chat-1",
        lastReadAt: new Date("2026-02-10T00:00:00.000Z").getTime(),
        unreadCount: 3
      }
    });
  });

  it("returns unread count when lastReadAt is null", async () => {
    const handlers: Record<string, (request: any, reply: any) => Promise<unknown>> = {};
    const app = {
      post: (path: string, handler: (request: any, reply: any) => Promise<unknown>) => {
        handlers[path] = handler;
      },
      get: (path: string, handler: (request: any, reply: any) => Promise<unknown>) => {
        handlers[path] = handler;
      }
    } as FastifyInstance;

    const count = vi.fn().mockResolvedValue(5);
    const context = {
      db: {
        message: {
          count
        }
      }
    } as unknown as ApiContext;

    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "user-1" } as any
    });
    vi.mocked(chatMembershipEnsure).mockResolvedValue({
      id: "membership-1",
      lastReadAt: null
    } as any);

    await readRoutesRegister(app, context);

    const readState = handlers["/api/org/:orgid/channels/:channelId/read-state"];
    if (!readState) {
      throw new Error("read-state handler not registered");
    }
    const result = await readState({
      params: {
        orgid: "org-1",
        channelId: "chat-1"
      }
    }, {} as any);

    expect(count).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        createdAt: undefined
      })
    }));
    expect(result).toEqual({
      ok: true,
      data: {
        chatId: "chat-1",
        lastReadAt: null,
        unreadCount: 5
      }
    });
  });
});
