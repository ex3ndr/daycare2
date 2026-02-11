import type { FastifyRequest } from "fastify";
import type { ApiContext, AuthContext } from "./apiContext.js";
import { ApiError } from "./apiError.js";
import { accountSessionResolve } from "./accountSessionResolve.js";

export async function authContextResolve(
  request: FastifyRequest,
  context: ApiContext,
  organizationId: string
): Promise<AuthContext> {
  const session = await accountSessionResolve(request, context);

  const user = await context.db.user.findFirst({
    where: {
      accountId: session.accountId,
      organizationId
    }
  });

  if (!user) {
    throw new ApiError(403, "FORBIDDEN", "Not a member of this organization");
  }

  if (user.deactivatedAt !== null) {
    throw new ApiError(403, "FORBIDDEN", "Account has been deactivated");
  }

  return {
    session: session.session,
    user
  };
}
