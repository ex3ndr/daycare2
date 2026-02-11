import type { OrgInvite } from "@prisma/client";
import { createId } from "@paralleldrive/cuid2";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { ApiError } from "@/apps/api/lib/apiError.js";
import { organizationRecipientIdsResolve } from "@/apps/api/lib/organizationRecipientIdsResolve.js";
import { databaseTransactionRun } from "@/modules/database/databaseTransactionRun.js";

const DEFAULT_INVITE_TTL_DAYS = 7;

type OrgInviteCreateInput = {
  organizationId: string;
  actorUserId: string;
  email: string;
};

export async function orgInviteCreate(
  context: ApiContext,
  input: OrgInviteCreateInput
): Promise<OrgInvite> {
  const email = input.email.trim().toLowerCase();

  const invite = await databaseTransactionRun(context.db, async (tx) => {
    // Verify actor is an active OWNER
    const actor = await tx.user.findFirst({
      where: {
        id: input.actorUserId,
        organizationId: input.organizationId,
        deactivatedAt: null
      }
    });

    if (!actor || actor.orgRole !== "OWNER") {
      throw new ApiError(403, "FORBIDDEN", "Only organization owners can create invites");
    }

    // Check if email belongs to an existing member of this org
    const existingUser = await tx.user.findFirst({
      where: {
        organizationId: input.organizationId,
        account: { email }
      }
    });

    if (existingUser) {
      if (existingUser.deactivatedAt !== null) {
        throw new ApiError(409, "CONFLICT", "User with this email has been deactivated. Reactivate them instead.");
      }
      throw new ApiError(409, "CONFLICT", "User with this email is already a member of this organization");
    }

    // Check for existing pending (non-expired, non-revoked, non-accepted) invite
    const existingInvite = await tx.orgInvite.findUnique({
      where: {
        organizationId_email: {
          organizationId: input.organizationId,
          email
        }
      }
    });

    if (existingInvite) {
      const isPending = existingInvite.acceptedAt === null
        && existingInvite.revokedAt === null
        && existingInvite.expiresAt > new Date();

      if (isPending) {
        throw new ApiError(409, "CONFLICT", "A pending invite already exists for this email");
      }

      // Expired/revoked/accepted invite exists — update it with fresh data
      return await tx.orgInvite.update({
        where: { id: existingInvite.id },
        data: {
          invitedByUserId: input.actorUserId,
          expiresAt: new Date(Date.now() + DEFAULT_INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
          acceptedAt: null,
          revokedAt: null,
          createdAt: new Date()
        }
      });
    }

    return await tx.orgInvite.create({
      data: {
        id: createId(),
        organizationId: input.organizationId,
        invitedByUserId: input.actorUserId,
        email,
        expiresAt: new Date(Date.now() + DEFAULT_INVITE_TTL_DAYS * 24 * 60 * 60 * 1000)
      }
    });
  });

  const recipients = await organizationRecipientIdsResolve(context, input.organizationId);
  await context.updates.publishToUsers(recipients, "organization.invite.created", {
    orgId: input.organizationId,
    inviteId: invite.id,
    email
  });

  return invite;
}
