import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { authEmailOtpRequest } from "@/apps/auth/authEmailOtpRequest.js";
import { authEmailOtpVerify } from "@/apps/auth/authEmailOtpVerify.js";
import { authLogin } from "@/apps/auth/authLogin.js";
import { authLogout } from "@/apps/auth/authLogout.js";
import { accountSessionResolve } from "@/apps/api/lib/accountSessionResolve.js";
import { ApiError } from "@/apps/api/lib/apiError.js";
import { apiResponseOk } from "@/apps/api/lib/apiResponseOk.js";
import { rateLimitMiddleware } from "@/apps/api/lib/rateLimitMiddleware.js";

const loginBodySchema = z.object({
  email: z.string().email().trim().toLowerCase()
});

const otpRequestSchema = z.object({
  email: z.string().email().trim().toLowerCase()
});

const otpVerifySchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  code: z.string().trim().regex(/^\d{6}$/)
});

export async function authRoutesRegister(app: FastifyInstance, context: ApiContext): Promise<void> {
  const otpRequestRateLimit = rateLimitMiddleware(context, {
    scope: "auth.otp.request",
    limit: 5,
    windowSeconds: 60,
    keyCreate: (request) => otpRequestSchema.parse(request.body).email,
    message: "Too many OTP requests. Please retry later."
  });

  app.post("/api/auth/login", async (request) => {
    if (context.nodeEnv !== "development" && context.nodeEnv !== "test") {
      throw new ApiError(
        403,
        "FORBIDDEN",
        "Direct email login is disabled outside development and test environments"
      );
    }

    const body = loginBodySchema.parse(request.body);

    const result = await authLogin(context, body.email);

    return apiResponseOk(result);
  });

  app.post("/api/auth/email/request-otp", async (request, reply) => {
    const allowed = await otpRequestRateLimit(request, reply);
    if (!allowed) {
      return;
    }

    const body = otpRequestSchema.parse(request.body);

    const result = await authEmailOtpRequest(context, {
      email: body.email
    });

    return apiResponseOk(result);
  });

  app.post("/api/auth/email/verify-otp", async (request) => {
    const body = otpVerifySchema.parse(request.body);

    const result = await authEmailOtpVerify(context, {
      email: body.email,
      code: body.code
    });

    return apiResponseOk(result);
  });

  app.post("/api/auth/logout", async (request) => {
    const auth = await accountSessionResolve(request, context);

    await authLogout(context, auth.sessionId);

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
        public: organization.public,
        avatarUrl: organization.avatarUrl,
        createdAt: organization.createdAt.getTime(),
        updatedAt: organization.updatedAt.getTime()
      }))
    });
  });
}
