import { createHash } from "node:crypto";
import { createId } from "@paralleldrive/cuid2";
import type { FastifyRequest } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testLiveContextCreate } from "@/utils/testLiveContextCreate.js";
import { ApiError } from "./apiError.js";
import { authContextResolve } from "./authContextResolve.js";

type LiveContext = Awaited<ReturnType<typeof testLiveContextCreate>>;

function requestCreate(token: string): FastifyRequest {
  return {
    headers: {
      authorization: `Bearer ${token}`
    }
  } as FastifyRequest;
}

describe("authContextResolve", () => {
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

  async function seedAuth(organizationId: string, includeUserInOrg = true) {
    const accountId = createId();
    const sessionId = createId();
    const token = await live.context.tokens.issue(sessionId);

    await live.db.account.create({
      data: {
        id: accountId,
        email: `${createId().slice(0, 8)}@example.com`
      }
    });

    await live.db.session.create({
      data: {
        id: sessionId,
        accountId,
        tokenHash: createHash("sha256").update(token).digest("hex"),
        expiresAt: new Date(Date.now() + 60_000)
      }
    });

    if (includeUserInOrg) {
      await live.db.user.create({
        data: {
          id: createId(),
          organizationId,
          accountId,
          kind: "HUMAN",
          firstName: "Jane",
          username: `jane-${createId().slice(0, 6)}`
        }
      });
    }

    return { token, accountId };
  }

  it("returns auth context when account belongs to org", async () => {
    const organizationId = createId();
    await live.db.organization.create({
      data: {
        id: organizationId,
        slug: `org-${createId().slice(0, 8)}`,
        name: "Acme"
      }
    });

    const { token, accountId } = await seedAuth(organizationId, true);

    const result = await authContextResolve(requestCreate(token), live.context, organizationId);

    expect(result.session.accountId).toBe(accountId);
    expect(result.user.organizationId).toBe(organizationId);
  });

  it("throws forbidden when account is not in org", async () => {
    const organizationId = createId();
    await live.db.organization.create({
      data: {
        id: organizationId,
        slug: `org-${createId().slice(0, 8)}`,
        name: "Acme"
      }
    });

    const { token } = await seedAuth(organizationId, false);

    const result = authContextResolve(requestCreate(token), live.context, organizationId);
    await expect(result).rejects.toBeInstanceOf(ApiError);
    await expect(result).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN"
    });
  });

  it("throws forbidden when user is deactivated", async () => {
    const organizationId = createId();
    await live.db.organization.create({
      data: {
        id: organizationId,
        slug: `org-${createId().slice(0, 8)}`,
        name: "Acme"
      }
    });

    const { token, accountId } = await seedAuth(organizationId, true);

    // Deactivate the user
    await live.db.user.updateMany({
      where: { accountId, organizationId },
      data: { deactivatedAt: new Date() }
    });

    const result = authContextResolve(requestCreate(token), live.context, organizationId);
    await expect(result).rejects.toBeInstanceOf(ApiError);
    await expect(result).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN",
      message: "Account has been deactivated"
    });
  });
});
