import type { User } from "@prisma/client";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { ApiError } from "@/apps/api/lib/apiError.js";
import { organizationRecipientIdsResolve } from "@/apps/api/lib/organizationRecipientIdsResolve.js";
import { databaseTransactionRun } from "@/modules/database/databaseTransactionRun.js";

type OrgMemberRoleSetInput = {
  organizationId: string;
  actorUserId: string;
  targetUserId: string;
  role: "OWNER" | "MEMBER";
};

export async function orgMemberRoleSet(
  context: ApiContext,
  input: OrgMemberRoleSetInput
): Promise<User> {
  if (input.actorUserId === input.targetUserId) {
    throw new ApiError(400, "VALIDATION_ERROR", "You cannot change your own role");
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
      throw new ApiError(403, "FORBIDDEN", "Only organization owners can change member roles");
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
      throw new ApiError(400, "VALIDATION_ERROR", "Cannot change role of a deactivated user");
    }

    if (target.orgRole === input.role) {
      throw new ApiError(400, "VALIDATION_ERROR", "User already has this role");
    }

    // Prevent demoting the last active OWNER
    if (target.orgRole === "OWNER" && input.role === "MEMBER") {
      const ownerCount = await tx.user.count({
        where: {
          organizationId: input.organizationId,
          orgRole: "OWNER",
          deactivatedAt: null
        }
      });
      if (ownerCount <= 1) {
        throw new ApiError(400, "VALIDATION_ERROR", "Cannot demote the last organization owner");
      }
    }

    return await tx.user.update({
      where: { id: input.targetUserId },
      data: { orgRole: input.role }
    });
  });

  const recipients = await organizationRecipientIdsResolve(context, input.organizationId);
  await context.updates.publishToUsers(recipients, "organization.member.updated", {
    orgId: input.organizationId,
    userId: input.targetUserId,
    orgRole: input.role
  });

  return user;
}
