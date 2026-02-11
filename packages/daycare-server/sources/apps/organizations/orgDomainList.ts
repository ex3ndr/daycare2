import type { OrgDomain } from "@prisma/client";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { ApiError } from "@/apps/api/lib/apiError.js";

type OrgDomainListInput = {
  organizationId: string;
  actorUserId: string;
};

export async function orgDomainList(
  context: ApiContext,
  input: OrgDomainListInput
): Promise<OrgDomain[]> {
  // Verify actor is an active member of this org
  const actor = await context.db.user.findFirst({
    where: {
      id: input.actorUserId,
      organizationId: input.organizationId,
      deactivatedAt: null
    }
  });

  if (!actor) {
    throw new ApiError(403, "FORBIDDEN", "You are not an active member of this organization");
  }

  return await context.db.orgDomain.findMany({
    where: { organizationId: input.organizationId },
    orderBy: { createdAt: "desc" }
  });
}
