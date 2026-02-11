import { createId } from "@paralleldrive/cuid2";
import { Prisma } from "@prisma/client";
import type { FastifyRequest } from "fastify";
import { createHash } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testLiveContextCreate } from "@/utils/testLiveContextCreate.js";
import { idempotencyGuard } from "./idempotencyGuard.js";

type LiveContext = Awaited<ReturnType<typeof testLiveContextCreate>>;

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

describe("idempotencyGuard", () => {
  let live: LiveContext;

  beforeAll(async () => {
    live = await testLiveContextCreate();
  });

  beforeEach(async () => {
    await live.reset();
  });

  afterAll(async () => {
    await live.close();
  });

  it("executes handler when no idempotency key", async () => {
    let called = 0;

    const result = await idempotencyGuard(
      requestCreate({}),
      live.context,
      { type: "user", id: createId() },
      async () => {
        called += 1;
        return { ok: true };
      }
    );

    expect(result).toEqual({ ok: true });
    expect(called).toBe(1);
  });

  it("returns stored response for matching key and payload", async () => {
    const subjectId = createId();
    const request = requestCreate({ key: "abc", body: { text: "hi" } });
    let called = 0;

    const first = await idempotencyGuard(
      request,
      live.context,
      { type: "user", id: subjectId },
      async () => {
        called += 1;
        return { ok: true, value: 123 };
      }
    );

    const second = await idempotencyGuard(
      request,
      live.context,
      { type: "user", id: subjectId },
      async () => {
        called += 1;
        return { ok: true, value: 456 };
      }
    );

    expect(first).toEqual({ ok: true, value: 123 });
    expect(second).toEqual({ ok: true, value: 123 });
    expect(called).toBe(1);
  });

  it("throws conflict when key is reused with different payload", async () => {
    const subjectId = createId();
    const key = "abc";

    await idempotencyGuard(
      requestCreate({ key, body: { text: "hi" } }),
      live.context,
      { type: "user", id: subjectId },
      async () => ({ ok: true })
    );

    await expect(
      idempotencyGuard(
        requestCreate({ key, body: { text: "other" } }),
        live.context,
        { type: "user", id: subjectId },
        async () => ({ ok: true })
      )
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "IDEMPOTENCY_CONFLICT"
    });
  });

  it("throws in-progress when record exists without response", async () => {
    const subjectId = createId();
    const scope = "POST /api/org/1/messages/send";
    const body = { text: "hi" };
    const requestHash = createHash("sha256")
      .update(scope)
      .update("\n")
      .update(JSON.stringify(body))
      .digest("hex");

    await live.context.db.idempotencyKey.create({
      data: {
        id: createId(),
        subjectType: "user",
        subjectId,
        scope,
        key: "abc",
        requestHash,
        responseJson: Prisma.DbNull
      }
    });

    await expect(
      idempotencyGuard(
        requestCreate({ key: "abc", body }),
        live.context,
        { type: "user", id: subjectId },
        async () => ({ ok: true })
      )
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "IDEMPOTENCY_IN_PROGRESS"
    });
  });

  it("cleans up key on handler error", async () => {
    const subjectId = createId();

    await expect(
      idempotencyGuard(
        requestCreate({ key: "abc", body: { text: "hi" } }),
        live.context,
        { type: "user", id: subjectId },
        async () => {
          throw new Error("boom");
        }
      )
    ).rejects.toThrow("boom");

    const row = await live.context.db.idempotencyKey.findUnique({
      where: {
        subjectType_subjectId_scope_key: {
          subjectType: "user",
          subjectId,
          scope: "POST /api/org/1/messages/send",
          key: "abc"
        }
      }
    });

    expect(row).toBeNull();
  });
});
