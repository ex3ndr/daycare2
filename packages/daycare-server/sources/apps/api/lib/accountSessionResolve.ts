import type { FastifyRequest } from "fastify";
import type { Session } from "@prisma/client";
import { createHash } from "node:crypto";
import { ApiError } from "./apiError.js";
import type { ApiContext } from "./apiContext.js";
import { authTokenExtract } from "./authTokenExtract.js";

export async function accountSessionResolve(request: FastifyRequest, context: ApiContext): Promise<{
  session: Session;
  sessionId: string;
  accountId: string;
}> {
  const token = authTokenExtract(request);
  const claims = await context.tokens.verify(token);

  if (!claims?.sessionId) {
    throw new ApiError(401, "UNAUTHORIZED", "Invalid token");
  }

  const session = await context.db.session.findUnique({
    where: {
      id: claims.sessionId
    }
  });

  if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
    throw new ApiError(401, "UNAUTHORIZED", "Session expired or revoked");
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  if (session.tokenHash !== tokenHash) {
    throw new ApiError(401, "UNAUTHORIZED", "Invalid session token");
  }

  return {
    session,
    sessionId: session.id,
    accountId: session.accountId
  };
}
