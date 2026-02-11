import type { OrgInvite } from "@prisma/client";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { ApiError } from "@/apps/api/lib/apiError.js";

type OrgInviteListInput = {
  organizationId: string;
  actorUserId: string;
};

export type OrgInviteListItem = OrgInvite & {
  expired: boolean;
};

export async function orgInviteList(
  context: ApiContext,
  input: OrgInviteListInput
): Promise<OrgInviteListItem[]> {
  // Verify actor is an active member of this org
  const actor = await context.db.user.findFirst({
    where: {
      id: input.actorUserId,
      organizationId: input.organizationId,
      deactivatedAt: null
    }
  });

  if (!actor) {
    throw new ApiError(403, "FORBIDDEN", "You are not an active member of this organization");
  }

  const invites = await context.db.orgInvite.findMany({
    where: { organizationId: input.organizationId },
    orderBy: { createdAt: "desc" }
  });

  const now = new Date();
  return invites.map((invite) => ({
    ...invite,
    expired: invite.acceptedAt === null
      && invite.revokedAt === null
      && invite.expiresAt < now
  }));
}
