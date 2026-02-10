import { createHash } from "node:crypto";
import type { FastifyRequest } from "fastify";
import type { ApiContext } from "./apiContext.js";
import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { idempotencyGuard } from "./idempotencyGuard.js";

function requestCreate(options: {
  key?: string;
  method?: string;
  url?: string;
  body?: unknown;
}): FastifyRequest {
  return {
    method: options.method ?? "POST",
    url: options.url ?? "/api/org/1/messages/send",
    headers: options.key ? { "idempotency-key": options.key } : {},
    body: options.body
  } as FastifyRequest;
}

function contextCreate(overrides: Partial<ApiContext["db"]["idempotencyKey"]> = {}): ApiContext {
  const idempotencyKey = {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    ...overrides
  };

  return {
    db: {
      idempotencyKey
    },
    redis: {},
    tokens: {},
    updates: {},
    nodeEnv: "test",
    allowOpenOrgJoin: true
  } as unknown as ApiContext;
}

describe("idempotencyGuard", () => {
  it("executes handler when no idempotency key", async () => {
    const context = contextCreate();
    const handler = vi.fn().mockResolvedValue({ ok: true });

    const result = await idempotencyGuard(requestCreate({}), context, { type: "user", id: "u1" }, handler);

    expect(result).toEqual({ ok: true });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(context.db.idempotencyKey.findUnique).not.toHaveBeenCalled();
  });

  it("returns stored response for matching key and payload", async () => {
    const request = requestCreate({ key: "abc", body: { text: "hi" } });
    const scope = `${request.method} ${request.url.split("?")[0]}`;
    const hash = requestHash(scope, request.body);

    const context = contextCreate({
      findUnique: vi.fn().mockResolvedValue({
        requestHash: hash,
        responseJson: { ok: true, value: 123 }
      })
    });

    const handler = vi.fn();

    const result = await idempotencyGuard(request, context, { type: "user", id: "u1" }, handler);

    expect(result).toEqual({ ok: true, value: 123 });
    expect(handler).not.toHaveBeenCalled();
  });

  it("throws conflict when key is reused with different payload", async () => {
    const context = contextCreate({
      findUnique: vi.fn().mockResolvedValue({
        requestHash: "hash",
        responseJson: { ok: true }
      })
    });

    await expect(
      idempotencyGuard(
        requestCreate({ key: "abc", body: { text: "hi" } }),
        context,
        { type: "user", id: "u1" },
        async () => ({ ok: true })
      )
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "IDEMPOTENCY_CONFLICT"
    });
  });

  it("throws in-progress when record exists without response", async () => {
    const context = contextCreate({
      findUnique: vi.fn().mockResolvedValue({
        requestHash: requestHash("POST /api/org/1/messages/send", { text: "hi" }),
        responseJson: null
      })
    });

    await expect(
      idempotencyGuard(
        requestCreate({ key: "abc", body: { text: "hi" } }),
        context,
        { type: "user", id: "u1" },
        async () => ({ ok: true })
      )
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "IDEMPOTENCY_IN_PROGRESS"
    });
  });

  it("stores response and cleans up on handler error", async () => {
    const create = vi.fn().mockResolvedValue({ id: "idem-1" });
    const update = vi.fn().mockResolvedValue({});
    const del = vi.fn().mockResolvedValue({});

    const context = contextCreate({
      findUnique: vi.fn().mockResolvedValue(null),
      create,
      update,
      delete: del
    });

    const request = requestCreate({ key: "abc", body: { text: "hi" } });
    const handler = vi.fn().mockResolvedValue({ ok: true, value: 5 });

    const result = await idempotencyGuard(request, context, { type: "user", id: "u1" }, handler);

    expect(result).toEqual({ ok: true, value: 5 });
    expect(create).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
    expect(del).not.toHaveBeenCalled();

    const failingContext = contextCreate({
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "idem-2" }),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({})
    });
    const failingHandler = vi.fn().mockRejectedValue(new Error("boom"));
    await expect(
      idempotencyGuard(request, failingContext, { type: "user", id: "u1" }, failingHandler)
    ).rejects.toBeInstanceOf(Error);
    expect(failingContext.db.idempotencyKey.delete).toHaveBeenCalled();
  });

  it("handles create race by re-reading existing record", async () => {
    const request = requestCreate({ key: "race", body: { text: "hi" } });
    const scope = `${request.method} ${request.url.split("?")[0]}`;
    const hash = requestHash(scope, request.body);

    const create = vi.fn().mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("boom", {
        code: "P2002",
        clientVersion: "6.0.0"
      })
    );
    const findUnique = vi.fn().mockResolvedValue({
      requestHash: hash,
      responseJson: { ok: true, value: 99 }
    });

    const context = contextCreate({
      findUnique,
      create
    });

    const result = await idempotencyGuard(request, context, { type: "user", id: "u1" }, async () => ({
      ok: true,
      value: 99
    }));

    expect(result).toEqual({ ok: true, value: 99 });
  });

  it("throws in-progress when create races without stored response", async () => {
    const request = requestCreate({ key: "race", body: { text: "hi" } });
    const scope = `${request.method} ${request.url.split("?")[0]}`;
    const hash = requestHash(scope, request.body);

    const create = vi.fn().mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("boom", {
        code: "P2002",
        clientVersion: "6.0.0"
      })
    );
    const findUnique = vi.fn().mockResolvedValue({
      requestHash: hash,
      responseJson: null
    });

    const context = contextCreate({
      findUnique,
      create
    });

    await expect(
      idempotencyGuard(request, context, { type: "user", id: "u1" }, async () => ({
        ok: true
      }))
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "IDEMPOTENCY_IN_PROGRESS"
    });
  });
});

function requestHash(scope: string, body: unknown): string {
  const bodyValue = typeof body === "string" ? body : JSON.stringify(body ?? {});
  return createHash("sha256").update(scope).update("\n").update(bodyValue).digest("hex");
}
