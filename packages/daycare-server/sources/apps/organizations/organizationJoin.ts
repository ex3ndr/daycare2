import { createId } from "@paralleldrive/cuid2";
import { Prisma, type Organization, type User } from "@prisma/client";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { ApiError } from "@/apps/api/lib/apiError.js";
import { organizationRecipientIdsResolve } from "@/apps/api/lib/organizationRecipientIdsResolve.js";
import { databaseTransactionRun } from "@/modules/database/databaseTransactionRun.js";

type OrganizationJoinInput = {
  accountId: string;
  organizationId: string;
  firstName: string;
  username: string;
};

type OrganizationJoinResult = {
  organization: Organization;
  user: User;
};

export async function organizationJoin(
  context: ApiContext,
  input: OrganizationJoinInput
): Promise<OrganizationJoinResult> {
  let isNew = false;

  const { organization, user } = await databaseTransactionRun(context.db, async (tx) => {
    const organization = await tx.organization.findUnique({
      where: {
        id: input.organizationId
      }
    });

    if (!organization) {
      throw new ApiError(404, "NOT_FOUND", "Organization not found");
    }

    // Check if user already exists in this org
    let user = await tx.user.findFirst({
      where: {
        accountId: input.accountId,
        organizationId: organization.id
      }
    });

    // If user was previously deactivated, block rejoin
    if (user && user.deactivatedAt !== null) {
      throw new ApiError(403, "FORBIDDEN", "Account has been deactivated, contact an admin");
    }

    // If user already exists and is active, return early
    if (user) {
      return { organization, user };
    }

    // Look up account email for invite/domain checks
    const account = await tx.account.findUnique({
      where: { id: input.accountId },
      select: { email: true }
    });

    if (!account) {
      throw new ApiError(404, "NOT_FOUND", "Account not found");
    }

    const email = account.email.toLowerCase();
    const emailDomain = email.split("@")[1];

    // Determine join authorization and look for a matching invite to mark as accepted
    let matchedInviteId: string | null = null;

    // Always check for a matching invite (to mark it accepted on join)
    const invite = await tx.orgInvite.findFirst({
      where: {
        organizationId: organization.id,
        email,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() }
      }
    });

    if (invite) {
      matchedInviteId = invite.id;
    }

    // Enforce join authorization unless open join is enabled
    if (!organization.public && !context.allowOpenOrgJoin && !matchedInviteId) {
      // Check for domain match
      const domainMatch = emailDomain
        ? await tx.orgDomain.findFirst({
            where: {
              organizationId: organization.id,
              domain: emailDomain
            }
          })
        : null;

      if (!domainMatch) {
        throw new ApiError(403, "FORBIDDEN", "Organization is not available to join");
      }
    }

    // Create the user
    try {
      isNew = true;
      user = await tx.user.create({
        data: {
          id: createId(),
          organizationId: organization.id,
          accountId: input.accountId,
          kind: "HUMAN",
          firstName: input.firstName,
          username: input.username
        }
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        isNew = false;
        user = await tx.user.findFirst({
          where: {
            accountId: input.accountId,
            organizationId: organization.id
          }
        });
      } else {
        throw error;
      }
    }

    if (!user) {
      throw new ApiError(500, "INTERNAL_ERROR", "Failed to join organization");
    }

    // Check deactivation on P2002 recovery path
    if (user.deactivatedAt !== null) {
      throw new ApiError(403, "FORBIDDEN", "Account has been deactivated, contact an admin");
    }

    // Mark invite as accepted if we matched one
    if (matchedInviteId) {
      await tx.orgInvite.update({
        where: { id: matchedInviteId },
        data: { acceptedAt: new Date() }
      });
    }

    return {
      organization,
      user
    };
  });

  if (isNew) {
    const recipients = await organizationRecipientIdsResolve(context, organization.id);
    await context.updates.publishToUsers(recipients, "organization.member.joined", {
      orgId: organization.id,
      userId: user.id
    });
  }

  return {
    organization,
    user
  };
}
