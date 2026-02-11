import type { OrgInvite } from "@prisma/client";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { ApiError } from "@/apps/api/lib/apiError.js";
import { organizationRecipientIdsResolve } from "@/apps/api/lib/organizationRecipientIdsResolve.js";
import { databaseTransactionRun } from "@/modules/database/databaseTransactionRun.js";

type OrgInviteRevokeInput = {
  organizationId: string;
  actorUserId: string;
  inviteId: string;
};

export async function orgInviteRevoke(
  context: ApiContext,
  input: OrgInviteRevokeInput
): Promise<OrgInvite> {
  const updated = await databaseTransactionRun(context.db, async (tx) => {
    // Verify actor is an active OWNER
    const actor = await tx.user.findFirst({
      where: {
        id: input.actorUserId,
        organizationId: input.organizationId,
        deactivatedAt: null
      }
    });

    if (!actor || actor.orgRole !== "OWNER") {
      throw new ApiError(403, "FORBIDDEN", "Only organization owners can revoke invites");
    }

    const invite = await tx.orgInvite.findFirst({
      where: {
        id: input.inviteId,
        organizationId: input.organizationId
      }
    });

    if (!invite) {
      throw new ApiError(404, "NOT_FOUND", "Invite not found");
    }

    if (invite.acceptedAt !== null) {
      throw new ApiError(400, "VALIDATION_ERROR", "Invite has already been accepted");
    }

    if (invite.revokedAt !== null) {
      throw new ApiError(400, "VALIDATION_ERROR", "Invite has already been revoked");
    }

    return await tx.orgInvite.update({
      where: { id: input.inviteId },
      data: { revokedAt: new Date() }
    });
  });

  const recipients = await organizationRecipientIdsResolve(context, input.organizationId);
  await context.updates.publishToUsers(recipients, "organization.invite.revoked", {
    orgId: input.organizationId,
    inviteId: input.inviteId
  });

  return updated;
}
