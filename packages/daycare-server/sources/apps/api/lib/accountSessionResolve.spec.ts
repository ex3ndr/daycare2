import { createHash } from "node:crypto";
import type { Session } from "@prisma/client";
import type { FastifyRequest } from "fastify";
import type { ApiContext } from "./apiContext.js";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "./apiError.js";
import { accountSessionResolve } from "./accountSessionResolve.js";

function requestCreate(token: string): FastifyRequest {
  return {
    headers: {
      authorization: `Bearer ${token}`
    }
  } as FastifyRequest;
}

function tokenHashCreate(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function sessionCreate(token: string): Session {
  const now = new Date();

  return {
    id: "session-1",
    accountId: "account-1",
    tokenHash: tokenHashCreate(token),
    createdAt: now,
    expiresAt: new Date(now.getTime() + 30 * 60 * 1000),
    revokedAt: null,
    lastSeenAt: null
  };
}

function contextCreate(params: {
  claims: { sessionId: string; extras: Record<string, unknown> } | null;
  session: Session | null;
}): { context: ApiContext; verify: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn> } {
  const verify = vi.fn().mockResolvedValue(params.claims);
  const findUnique = vi.fn().mockResolvedValue(params.session);

  const context = {
    db: {
      session: {
        findUnique
      }
    },
    tokens: {
      issue: vi.fn(),
      verify
    },
    redis: {},
    updates: {},
    nodeEnv: "test",
    allowOpenOrgJoin: true
  } as unknown as ApiContext;

  return {
    context,
    verify,
    findUnique
  };
}

describe("accountSessionResolve", () => {
  it("returns session and ids for valid bearer token", async () => {
    const token = "token-abc";
    const session = sessionCreate(token);
    const { context, verify, findUnique } = contextCreate({
      claims: { sessionId: "session-1", extras: {} },
      session
    });

    await expect(accountSessionResolve(requestCreate(token), context)).resolves.toEqual({
      session,
      sessionId: "session-1",
      accountId: "account-1"
    });

    expect(verify).toHaveBeenCalledWith(token);
    expect(findUnique).toHaveBeenCalledWith({
      where: {
        id: "session-1"
      }
    });
  });

  it("rejects invalid token claims", async () => {
    const { context } = contextCreate({
      claims: null,
      session: null
    });

    const result = accountSessionResolve(requestCreate("token-abc"), context);
    await expect(result).rejects.toBeInstanceOf(ApiError);
    await expect(result).rejects.toMatchObject({
      statusCode: 401,
      code: "UNAUTHORIZED"
    });
  });

  it("rejects expired or revoked session", async () => {
    const token = "token-abc";
    const base = sessionCreate(token);
    const { context } = contextCreate({
      claims: { sessionId: "session-1", extras: {} },
      session: {
        ...base,
        revokedAt: new Date("2026-02-10T00:05:00.000Z")
      }
    });

    await expect(accountSessionResolve(requestCreate(token), context)).rejects.toMatchObject({
      statusCode: 401,
      code: "UNAUTHORIZED"
    });
  });

  it("rejects mismatched token hash", async () => {
    const token = "token-abc";
    const { context } = contextCreate({
      claims: { sessionId: "session-1", extras: {} },
      session: {
        ...sessionCreate(token),
        tokenHash: tokenHashCreate("different-token")
      }
    });

    await expect(accountSessionResolve(requestCreate(token), context)).rejects.toMatchObject({
      statusCode: 401,
      code: "UNAUTHORIZED"
    });
  });
});
