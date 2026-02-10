import type { ApiContext } from "@/apps/api/lib/apiContext.js";

export async function authLogout(context: ApiContext, sessionId: string): Promise<void> {
  await context.db.session.update({
    where: {
      id: sessionId
    },
    data: {
      revokedAt: new Date()
    }
  });
}
