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
  const where: Prisma.OrganizationWhereInput = {
    OR: [
      {
        users: {
          some: {
            accountId: input.accountId
          }
        }
      },
      {
        public: true
      }
    ]
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
