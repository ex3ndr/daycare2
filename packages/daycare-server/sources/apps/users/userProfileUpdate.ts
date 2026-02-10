import type { User } from "@prisma/client";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { organizationRecipientIdsResolve } from "@/apps/api/lib/organizationRecipientIdsResolve.js";

type UserProfileUpdateInput = {
  userId: string;
  firstName?: string;
  lastName?: string | null;
  username?: string;
  bio?: string | null;
  timezone?: string | null;
  avatarUrl?: string | null;
};

export async function userProfileUpdate(
  context: ApiContext,
  input: UserProfileUpdateInput
): Promise<User> {
  const updated = await context.db.user.update({
    where: {
      id: input.userId
    },
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      username: input.username,
      bio: input.bio,
      timezone: input.timezone,
      avatarUrl: input.avatarUrl
    }
  });

  const recipients = await organizationRecipientIdsResolve(context, updated.organizationId);
  await context.updates.publishToUsers(recipients, "user.updated", {
    orgId: updated.organizationId,
    userId: updated.id
  });

  return updated;
}
