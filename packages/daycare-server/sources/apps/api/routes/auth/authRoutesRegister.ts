import { createId } from "@paralleldrive/cuid2";
import type { FastifyInstance } from "fastify";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { accountSessionResolve } from "@/apps/api/lib/accountSessionResolve.js";
import { ApiError } from "@/apps/api/lib/apiError.js";
import { apiResponseOk } from "@/apps/api/lib/apiResponseOk.js";

const loginBodySchema = z.object({
  email: z.string().email().trim().toLowerCase()
});

export async function authRoutesRegister(app: FastifyInstance, context: ApiContext): Promise<void> {
  app.post("/api/auth/login", async (request) => {
    if (context.nodeEnv !== "development" && context.nodeEnv !== "test") {
      throw new ApiError(
        403,
        "FORBIDDEN",
        "Direct email login is disabled outside development and test environments"
      );
    }

    const body = loginBodySchema.parse(request.body);

    let account = await context.db.account.findUnique({
      where: {
        email: body.email
      }
    });

    if (!account) {
      account = await context.db.account.create({
        data: {
          id: createId(),
          email: body.email
        }
      });
    }

    const sessionId = createId();
    const token = await context.tokens.issue(sessionId, {
      accountId: account.id
    });
    const tokenHash = createHash("sha256").update(token).digest("hex");

    const session = await context.db.session.create({
      data: {
        id: sessionId,
        accountId: account.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)
      }
    });

    return apiResponseOk({
      token,
      account: {
        id: account.id,
        email: account.email,
        createdAt: account.createdAt.getTime(),
        updatedAt: account.updatedAt.getTime()
      },
      session: {
        id: session.id,
        expiresAt: session.expiresAt.getTime()
      }
    });
  });

  app.post("/api/auth/logout", async (request) => {
    const auth = await accountSessionResolve(request, context);

    await context.db.session.update({
      where: {
        id: auth.sessionId
      },
      data: {
        revokedAt: new Date()
      }
    });

    return apiResponseOk({
      revoked: true
    });
  });

  app.get("/api/me", async (request) => {
    const auth = await accountSessionResolve(request, context);

    const account = await context.db.account.findUnique({
      where: {
        id: auth.accountId
      }
    });

    if (!account) {
      throw new ApiError(404, "NOT_FOUND", "Account not found");
    }

    const organizations = await context.db.organization.findMany({
      where: {
        users: {
          some: {
            accountId: account.id
          }
        }
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    return apiResponseOk({
      account: {
        id: account.id,
        email: account.email,
        createdAt: account.createdAt.getTime(),
        updatedAt: account.updatedAt.getTime()
      },
      organizations: organizations.map((organization) => ({
        id: organization.id,
        slug: organization.slug,
        name: organization.name,
        avatarUrl: organization.avatarUrl,
        createdAt: organization.createdAt.getTime(),
        updatedAt: organization.updatedAt.getTime()
      }))
    });
  });
}
