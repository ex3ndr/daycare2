import { createId } from "@paralleldrive/cuid2";
import { createHash } from "node:crypto";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";

type AuthLoginResult = {
  token: string;
  account: {
    id: string;
    email: string;
    createdAt: number;
    updatedAt: number;
  };
  session: {
    id: string;
    expiresAt: number;
  };
};

export async function authLogin(context: ApiContext, email: string): Promise<AuthLoginResult> {
  let account = await context.db.account.findUnique({
    where: {
      email
    }
  });

  if (!account) {
    account = await context.db.account.create({
      data: {
        id: createId(),
        email
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

  return {
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
  };
}
