import { createId } from "@paralleldrive/cuid2";
import { Prisma, type User } from "@prisma/client";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { ApiError } from "@/apps/api/lib/apiError.js";

type AiBotCreateInput = {
  organizationId: string;
  username: string;
  firstName: string;
  systemPrompt: string;
  webhookUrl: string;
  avatarUrl?: string | null;
};

export async function aiBotCreate(
  context: ApiContext,
  input: AiBotCreateInput
): Promise<User> {
  try {
    return await context.db.user.create({
      data: {
        id: createId(),
        organizationId: input.organizationId,
        kind: "AI",
        firstName: input.firstName,
        username: input.username,
        systemPrompt: input.systemPrompt,
        webhookUrl: input.webhookUrl,
        avatarUrl: input.avatarUrl
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ApiError(409, "CONFLICT", "Username is already used");
    }
    throw error;
  }
}
