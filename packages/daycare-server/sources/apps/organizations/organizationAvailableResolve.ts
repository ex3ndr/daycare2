import { Prisma, type Organization } from "@prisma/client";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";

type OrganizationAvailableResolveInput = {
  accountId: string;
  organizationId?: string;
};

export async function organizationAvailableResolve(
  context: ApiContext,
  input: OrganizationAvailableResolveInput
): Promise<Organization[]> {
  // Look up account email for invite/domain matching
  const account = await context.db.account.findUnique({
    where: { id: input.accountId },
    select: { email: true }
  });

  const orConditions: Prisma.OrganizationWhereInput[] = [
    {
      users: {
        some: {
          accountId: input.accountId,
          deactivatedAt: null
        }
      }
    },
    {
      public: true
    }
  ];

  if (account) {
    const email = account.email.toLowerCase();
    const emailDomain = email.split("@")[1];

    // Orgs with a pending, non-expired, non-revoked invite for this email
    orConditions.push({
      invites: {
        some: {
          email,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() }
        }
      }
    });

    // Orgs with a domain allowlist entry matching this email's domain
    if (emailDomain) {
      orConditions.push({
        domains: {
          some: {
            domain: emailDomain
          }
        }
      });
    }
  }

  const where: Prisma.OrganizationWhereInput = {
    OR: orConditions,
    // Exclude orgs where this account's user was deactivated
    NOT: {
      users: {
        some: {
          accountId: input.accountId,
          deactivatedAt: { not: null }
        }
      }
    }
  };

  if (input.organizationId) {
    where.id = input.organizationId;
  }

  return await context.db.organization.findMany({
    where,
    orderBy: {
      createdAt: "asc"
    }
  });
}
