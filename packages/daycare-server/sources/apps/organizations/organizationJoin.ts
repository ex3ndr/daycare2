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
  const { organization, user } = await databaseTransactionRun(context.db, async (tx) => {
    // Optimistic transaction: TOCTU between org lookup and user creation is acceptable here.
    const organization = await tx.organization.findUnique({
      where: {
        id: input.organizationId
      }
    });

    if (!organization) {
      throw new ApiError(404, "NOT_FOUND", "Organization not found");
    }

    let user = await tx.user.findFirst({
      where: {
        accountId: input.accountId,
        organizationId: organization.id
      }
    });

    if (!user) {
      try {
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
    }

    if (!user) {
      throw new ApiError(500, "INTERNAL_ERROR", "Failed to join organization");
    }

    return {
      organization,
      user
    };
  });

  const recipients = await organizationRecipientIdsResolve(context, organization.id);
  await context.updates.publishToUsers(recipients, "organization.member.joined", {
    orgId: organization.id,
    userId: user.id
  });

  return {
    organization,
    user
  };
}
