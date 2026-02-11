import type { User } from "@prisma/client";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";

type AiBotListInput = {
  organizationId: string;
};

export async function aiBotList(
  context: ApiContext,
  input: AiBotListInput
): Promise<User[]> {
  return await context.db.user.findMany({
    where: {
      organizationId: input.organizationId,
      kind: "AI"
    },
    orderBy: {
      username: "asc"
    }
  });
}
