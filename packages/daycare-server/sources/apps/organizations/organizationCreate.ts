import { createId } from "@paralleldrive/cuid2";
import { Prisma, type Organization } from "@prisma/client";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { ApiError } from "@/apps/api/lib/apiError.js";
import { organizationRecipientIdsResolve } from "@/apps/api/lib/organizationRecipientIdsResolve.js";

type OrganizationCreateInput = {
  accountId: string;
  slug: string;
  name: string;
  firstName: string;
  username: string;
};

export async function organizationCreate(
  context: ApiContext,
  input: OrganizationCreateInput
): Promise<Organization> {
  let org: Organization;

  try {
    org = await context.db.organization.create({
      data: {
        id: createId(),
        slug: input.slug,
        name: input.name,
        users: {
          create: {
            id: createId(),
            accountId: input.accountId,
            kind: "HUMAN",
            firstName: input.firstName,
            username: input.username
          }
        }
      }
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ApiError(409, "CONFLICT", "Organization slug is already taken");
    }
    throw error;
  }

  const recipients = await organizationRecipientIdsResolve(context, org.id);
  await context.updates.publishToUsers(recipients, "organization.created", {
    orgId: org.id
  });

  return org;
}
