import type { Session, User } from "@prisma/client";
import type { FastifyRequest } from "fastify";
import type { ApiContext } from "./apiContext.js";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "./apiError.js";

vi.mock("./accountSessionResolve.js", () => ({
  accountSessionResolve: vi.fn()
}));

import { accountSessionResolve } from "./accountSessionResolve.js";
import { authContextResolve } from "./authContextResolve.js";

function sessionCreate(): Session {
  return {
    id: "session-1",
    accountId: "account-1",
    tokenHash: "hash-1",
    createdAt: new Date("2026-02-10T00:00:00.000Z"),
    expiresAt: new Date("2026-02-10T01:00:00.000Z"),
    revokedAt: null,
    lastSeenAt: null
  };
}

function userCreate(): User {
  return {
    id: "user-1",
    organizationId: "org-1",
    accountId: "account-1",
    kind: "HUMAN",
    firstName: "Jane",
    lastName: null,
    username: "jane",
    bio: null,
    timezone: null,
    avatarUrl: null,
    systemPrompt: null,
    webhookUrl: null,
    createdAt: new Date("2026-02-10T00:00:00.000Z"),
    updatedAt: new Date("2026-02-10T00:00:00.000Z"),
    lastSeenAt: null
  };
}

describe("authContextResolve", () => {
  it("returns auth context when account belongs to org", async () => {
    const accountSessionResolveMock = vi.mocked(accountSessionResolve);
    const session = sessionCreate();
    const user = userCreate();
    accountSessionResolveMock.mockResolvedValue({
      session,
      sessionId: session.id,
      accountId: session.accountId
    });

    const findFirst = vi.fn().mockResolvedValue(user);
    const context = {
      db: {
        user: {
          findFirst
        }
      }
    } as unknown as ApiContext;

    const request = { headers: {} } as FastifyRequest;
    await expect(authContextResolve(request, context, "org-1")).resolves.toEqual({
      session,
      user
    });

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        accountId: "account-1",
        organizationId: "org-1"
      }
    });
  });

  it("throws forbidden when account is not in org", async () => {
    const accountSessionResolveMock = vi.mocked(accountSessionResolve);
    const session = sessionCreate();
    accountSessionResolveMock.mockResolvedValue({
      session,
      sessionId: session.id,
      accountId: session.accountId
    });

    const context = {
      db: {
        user: {
          findFirst: vi.fn().mockResolvedValue(null)
        }
      }
    } as unknown as ApiContext;

    const request = { headers: {} } as FastifyRequest;
    const result = authContextResolve(request, context, "org-1");
    await expect(result).rejects.toBeInstanceOf(ApiError);
    await expect(result).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN"
    });
  });
});
