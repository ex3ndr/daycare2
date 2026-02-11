import type { ApiContext } from "./apiContext.js";

export async function organizationRecipientIdsResolve(
  context: ApiContext,
  organizationId: string
): Promise<string[]> {
  const users = await context.db.user.findMany({
    where: {
      organizationId,
      deactivatedAt: null
    },
    select: {
      id: true
    }
  });

  return users.map((user) => user.id);
}
