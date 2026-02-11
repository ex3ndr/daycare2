import type { User } from "@prisma/client";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { ApiError } from "@/apps/api/lib/apiError.js";
import { organizationRecipientIdsResolve } from "@/apps/api/lib/organizationRecipientIdsResolve.js";
import { databaseTransactionRun } from "@/modules/database/databaseTransactionRun.js";

type OrgMemberDeactivateInput = {
  organizationId: string;
  actorUserId: string;
  targetUserId: string;
};

export async function orgMemberDeactivate(
  context: ApiContext,
  input: OrgMemberDeactivateInput
): Promise<User> {
  if (input.actorUserId === input.targetUserId) {
    throw new ApiError(400, "VALIDATION_ERROR", "You cannot deactivate yourself");
  }

  const user = await databaseTransactionRun(context.db, async (tx) => {
    const actor = await tx.user.findFirst({
      where: {
        id: input.actorUserId,
        organizationId: input.organizationId,
        deactivatedAt: null
      }
    });

    if (!actor || actor.orgRole !== "OWNER") {
      throw new ApiError(403, "FORBIDDEN", "Only organization owners can deactivate members");
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

    if (target.deactivatedAt !== null) {
      throw new ApiError(400, "VALIDATION_ERROR", "User is already deactivated");
    }

    if (target.orgRole === "OWNER") {
      throw new ApiError(403, "FORBIDDEN", "Cannot deactivate an organization owner, demote them first");
    }

    // Set leftAt on all active ChatMember records for this user in this org
    await tx.chatMember.updateMany({
      where: {
        userId: input.targetUserId,
        leftAt: null,
        chat: {
          organizationId: input.organizationId
        }
      },
      data: {
        leftAt: new Date()
      }
    });

    return await tx.user.update({
      where: { id: input.targetUserId },
      data: { deactivatedAt: new Date() }
    });
  });

  const recipients = await organizationRecipientIdsResolve(context, input.organizationId);
  await context.updates.publishToUsers(recipients, "organization.member.deactivated", {
    orgId: input.organizationId,
    userId: input.targetUserId
  });

  return user;
}
