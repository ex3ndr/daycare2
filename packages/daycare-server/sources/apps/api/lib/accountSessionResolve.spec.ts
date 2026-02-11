import { createHash } from "node:crypto";
import { createId } from "@paralleldrive/cuid2";
import type { FastifyRequest } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testLiveContextCreate } from "@/utils/testLiveContextCreate.js";
import { ApiError } from "./apiError.js";
import { accountSessionResolve } from "./accountSessionResolve.js";

type LiveContext = Awaited<ReturnType<typeof testLiveContextCreate>>;

function requestCreate(token: string): FastifyRequest {
  return {
    headers: {
      authorization: `Bearer ${token}`
    }
  } as FastifyRequest;
}

describe("accountSessionResolve", () => {
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

  async function seedSession(params?: {
    revokedAt?: Date | null;
    expiresAt?: Date;
    tokenHashOverride?: string;
  }) {
    const accountId = createId();
    await live.db.account.create({
      data: {
        id: accountId,
        email: `${createId().slice(0, 8)}@example.com`
      }
    });

    const sessionId = createId();
    const token = await live.context.tokens.issue(sessionId);
    const tokenHash = createHash("sha256").update(token).digest("hex");

    await live.db.session.create({
      data: {
        id: sessionId,
        accountId,
        tokenHash: params?.tokenHashOverride ?? tokenHash,
        expiresAt: params?.expiresAt ?? new Date(Date.now() + 60_000),
        revokedAt: params?.revokedAt ?? null
      }
    });

    return { token, sessionId, accountId };
  }

  it("returns session and ids for valid bearer token", async () => {
    const { token, sessionId, accountId } = await seedSession();

    const result = await accountSessionResolve(requestCreate(token), live.context);

    expect(result.sessionId).toBe(sessionId);
    expect(result.accountId).toBe(accountId);
    expect(result.session.id).toBe(sessionId);
  });

  it("rejects invalid token claims", async () => {
    const result = accountSessionResolve(requestCreate("not-a-valid-token"), live.context);

    await expect(result).rejects.toBeInstanceOf(ApiError);
    await expect(result).rejects.toMatchObject({
      statusCode: 401,
      code: "UNAUTHORIZED"
    });
  });

  it("rejects expired or revoked session", async () => {
    const { token } = await seedSession({
      revokedAt: new Date("2026-02-10T00:05:00.000Z")
    });

    await expect(accountSessionResolve(requestCreate(token), live.context)).rejects.toMatchObject({
      statusCode: 401,
      code: "UNAUTHORIZED"
    });
  });

  it("rejects mismatched token hash", async () => {
    const { token } = await seedSession({
      tokenHashOverride: createHash("sha256").update("different-token").digest("hex")
    });

    await expect(accountSessionResolve(requestCreate(token), live.context)).rejects.toMatchObject({
      statusCode: 401,
      code: "UNAUTHORIZED"
    });
  });
});
