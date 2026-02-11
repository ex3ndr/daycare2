import type { User } from "@prisma/client";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { ApiError } from "@/apps/api/lib/apiError.js";
import { organizationRecipientIdsResolve } from "@/apps/api/lib/organizationRecipientIdsResolve.js";
import { databaseTransactionRun } from "@/modules/database/databaseTransactionRun.js";

type OrgMemberReactivateInput = {
  organizationId: string;
  actorUserId: string;
  targetUserId: string;
};

export async function orgMemberReactivate(
  context: ApiContext,
  input: OrgMemberReactivateInput
): Promise<User> {
  const user = await databaseTransactionRun(context.db, async (tx) => {
    const actor = await tx.user.findFirst({
      where: {
        id: input.actorUserId,
        organizationId: input.organizationId,
        deactivatedAt: null
      }
    });

    if (!actor || actor.orgRole !== "OWNER") {
      throw new ApiError(403, "FORBIDDEN", "Only organization owners can reactivate members");
    }

    const target = await tx.user.findFirst({
      where: {
        id: input.targetUserId,
        organizationId: input.organizationId
      }
    });

    if (!target) {
      throw new ApiError(404, "NOT_FOUND", "User not found");
    }

    if (target.deactivatedAt === null) {
      throw new ApiError(400, "VALIDATION_ERROR", "User is not deactivated");
    }

    return await tx.user.update({
      where: { id: input.targetUserId },
      data: { deactivatedAt: null }
    });
  });

  const recipients = await organizationRecipientIdsResolve(context, input.organizationId);
  await context.updates.publishToUsers(recipients, "organization.member.reactivated", {
    orgId: input.organizationId,
    userId: input.targetUserId
  });

  return user;
}
