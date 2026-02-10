import { EventEmitter } from "node:events";
import type { FastifyInstance } from "fastify";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/apps/api/lib/authContextResolve.js", () => ({
  authContextResolve: vi.fn()
}));

import { authContextResolve } from "@/apps/api/lib/authContextResolve.js";
import { updateRoutesRegister } from "./updateRoutesRegister.js";

describe("updateRoutesRegister", () => {
  it("serves diff with updates", async () => {
    const handlers: Record<string, (request: unknown, reply: unknown) => Promise<unknown>> = {};
    const app = {
      post: (path: string, handler: (request: unknown, reply: unknown) => Promise<unknown>) => {
        handlers[path] = handler;
      },
      get: (path: string, handler: (request: unknown, reply: unknown) => Promise<unknown>) => {
        handlers[path] = handler;
      }
    } as FastifyInstance;

    const context = {
      updates: {
        diffGet: vi.fn().mockResolvedValue({
          updates: [],
          headOffset: 3,
          resetRequired: false
        }),
        subscribe: vi.fn()
      }
    } as unknown as ApiContext;

    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "user-1" } as any
    });

    await updateRoutesRegister(app, context);

    const diff = handlers["/api/org/:orgid/updates/diff"];
    if (!diff) {
      throw new Error("diff handler not registered");
    }
    const result = await diff({
      params: {
        orgid: "org-1"
      },
      body: {
        offset: 0,
        limit: 50
      }
    }, {} as any);

    expect(result).toEqual({
      ok: true,
      data: {
        updates: [],
        headOffset: 3,
        resetRequired: false
      }
    });
    expect(context.updates.diffGet).toHaveBeenCalledWith("user-1", 0, 50);
  });

  it("streams updates over SSE", async () => {
    vi.useFakeTimers();

    const handlers: Record<string, (request: any, reply: any) => Promise<unknown>> = {};
    const app = {
      post: (path: string, handler: (request: unknown, reply: unknown) => Promise<unknown>) => {
        handlers[path] = handler;
      },
      get: (path: string, handler: (request: unknown, reply: unknown) => Promise<unknown>) => {
        handlers[path] = handler;
      }
    } as FastifyInstance;

    const unsubscribe = vi.fn();
    const context = {
      updates: {
        diffGet: vi.fn(),
        subscribe: vi.fn().mockReturnValue(unsubscribe)
      }
    } as unknown as ApiContext;

    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "user-1" } as any
    });

    await updateRoutesRegister(app, context);

    const raw = new EventEmitter();
    const reply = {
      hijack: vi.fn(),
      raw: {
        write: vi.fn()
      }
    };

    const stream = handlers["/api/org/:orgid/updates/stream"];
    if (!stream) {
      throw new Error("stream handler not registered");
    }
    await stream({
      params: {
        orgid: "org-1"
      },
      raw
    }, reply);

    expect(reply.hijack).toHaveBeenCalledTimes(1);
    expect(context.updates.subscribe).toHaveBeenCalledWith("user-1", "org-1", reply);

    vi.advanceTimersByTime(15_000);
    expect(reply.raw.write).toHaveBeenCalled();

    raw.emit("close");
    expect(unsubscribe).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
