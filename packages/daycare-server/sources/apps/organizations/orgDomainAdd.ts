import { Prisma, type OrgDomain } from "@prisma/client";
import { createId } from "@paralleldrive/cuid2";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { ApiError } from "@/apps/api/lib/apiError.js";
import { organizationRecipientIdsResolve } from "@/apps/api/lib/organizationRecipientIdsResolve.js";
import { databaseTransactionRun } from "@/modules/database/databaseTransactionRun.js";

type OrgDomainAddInput = {
  organizationId: string;
  actorUserId: string;
  domain: string;
};

export async function orgDomainAdd(
  context: ApiContext,
  input: OrgDomainAddInput
): Promise<OrgDomain> {
  const domain = input.domain.trim().toLowerCase().replace(/^@/, "");

  // Validate domain format: must contain at least one dot and only valid chars
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(domain)) {
    throw new ApiError(400, "VALIDATION_ERROR", "Invalid domain format");
  }

  const orgDomain = await databaseTransactionRun(context.db, async (tx) => {
    // Verify actor is an active OWNER
    const actor = await tx.user.findFirst({
      where: {
        id: input.actorUserId,
        organizationId: input.organizationId,
        deactivatedAt: null
      }
    });

    if (!actor || actor.orgRole !== "OWNER") {
      throw new ApiError(403, "FORBIDDEN", "Only organization owners can add domains");
    }

    try {
      return await tx.orgDomain.create({
        data: {
          id: createId(),
          organizationId: input.organizationId,
          createdByUserId: input.actorUserId,
          domain
        }
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ApiError(409, "CONFLICT", "Domain is already in the allowlist");
      }
      throw error;
    }
  });

  const recipients = await organizationRecipientIdsResolve(context, input.organizationId);
  await context.updates.publishToUsers(recipients, "organization.domain.added", {
    orgId: input.organizationId,
    domainId: orgDomain.id,
    domain
  });

  return orgDomain;
}
