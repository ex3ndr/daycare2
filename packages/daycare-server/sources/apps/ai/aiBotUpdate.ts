import type { User } from "@prisma/client";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { ApiError } from "@/apps/api/lib/apiError.js";

type AiBotUpdateInput = {
  organizationId: string;
  userId: string;
  firstName?: string;
  systemPrompt?: string;
  webhookUrl?: string | null;
  avatarUrl?: string | null;
};

export async function aiBotUpdate(
  context: ApiContext,
  input: AiBotUpdateInput
): Promise<User> {
  const bot = await context.db.user.findFirst({
    where: {
      id: input.userId,
      organizationId: input.organizationId,
      kind: "AI"
    }
  });

  if (!bot) {
    throw new ApiError(404, "NOT_FOUND", "AI bot not found");
  }

  return await context.db.user.update({
    where: {
      id: input.userId
    },
    data: {
      firstName: input.firstName,
      systemPrompt: input.systemPrompt,
      webhookUrl: input.webhookUrl,
      avatarUrl: input.avatarUrl
    }
  });
}
