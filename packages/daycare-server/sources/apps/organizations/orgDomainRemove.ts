import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { ApiError } from "@/apps/api/lib/apiError.js";
import { organizationRecipientIdsResolve } from "@/apps/api/lib/organizationRecipientIdsResolve.js";

type OrgDomainRemoveInput = {
  organizationId: string;
  actorUserId: string;
  domainId: string;
};

export async function orgDomainRemove(
  context: ApiContext,
  input: OrgDomainRemoveInput
): Promise<void> {
  // Verify actor is an active OWNER
  const actor = await context.db.user.findFirst({
    where: {
      id: input.actorUserId,
      organizationId: input.organizationId,
      deactivatedAt: null
    }
  });

  if (!actor || actor.orgRole !== "OWNER") {
    throw new ApiError(403, "FORBIDDEN", "Only organization owners can remove domains");
  }

  const domain = await context.db.orgDomain.findFirst({
    where: {
      id: input.domainId,
      organizationId: input.organizationId
    }
  });

  if (!domain) {
    throw new ApiError(404, "NOT_FOUND", "Domain not found");
  }

  await context.db.orgDomain.delete({
    where: { id: input.domainId }
  });

  const recipients = await organizationRecipientIdsResolve(context, input.organizationId);
  await context.updates.publishToUsers(recipients, "organization.domain.removed", {
    orgId: input.organizationId,
    domainId: input.domainId
  });
}
