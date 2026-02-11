import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { ApiError } from "@/apps/api/lib/apiError.js";
import { apiResponseOk } from "@/apps/api/lib/apiResponseOk.js";
import { authContextResolve } from "@/apps/api/lib/authContextResolve.js";
import { idempotencyGuard } from "@/apps/api/lib/idempotencyGuard.js";
import { aiBotCreate } from "@/apps/ai/aiBotCreate.js";
import { aiBotList } from "@/apps/ai/aiBotList.js";
import { aiBotUpdate } from "@/apps/ai/aiBotUpdate.js";

const aiBotCreateSchema = z.object({
  username: z.string().trim().min(1).max(50),
  firstName: z.string().trim().min(1).max(100),
  systemPrompt: z.string().trim().min(1).max(10_000),
  webhookUrl: z.string().url().refine((value) => value.startsWith("https://"), "webhookUrl must use HTTPS"),
  avatarUrl: z.string().url().refine((value) => value.startsWith("https://"), "avatarUrl must use HTTPS").nullable().optional()
});

const aiBotUpdateSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  systemPrompt: z.string().trim().min(1).max(10_000).optional(),
  webhookUrl: z.string().url().refine((value) => value.startsWith("https://"), "webhookUrl must use HTTPS").nullable().optional(),
  avatarUrl: z.string().url().refine((value) => value.startsWith("https://"), "avatarUrl must use HTTPS").nullable().optional()
}).refine((value) => Object.keys(value).length > 0, "At least one field must be provided");

async function botManagementAuthorize(
  context: ApiContext,
  organizationId: string,
  userId: string
): Promise<void> {
  const ownerMembership = await context.db.chatMember.findFirst({
    where: {
      userId,
      role: "OWNER",
      leftAt: null,
      chat: {
        organizationId,
        kind: "CHANNEL"
      }
    },
    select: {
      id: true
    }
  });

  if (!ownerMembership) {
    throw new ApiError(403, "FORBIDDEN", "Only organization owners can manage AI bots");
  }
}

function aiBotSerialize(bot: {
  id: string;
  organizationId: string;
  username: string;
  firstName: string;
  avatarUrl: string | null;
  systemPrompt: string | null;
  webhookUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: bot.id,
    organizationId: bot.organizationId,
    kind: "ai",
    username: bot.username,
    firstName: bot.firstName,
    avatarUrl: bot.avatarUrl,
    systemPrompt: bot.systemPrompt,
    createdAt: bot.createdAt.getTime(),
    updatedAt: bot.updatedAt.getTime()
  };
}

export async function aiRoutesRegister(app: FastifyInstance, context: ApiContext): Promise<void> {
  app.post("/api/org/:orgid/bots", async (request) => {
    const params = z.object({ orgid: z.string().min(1) }).parse(request.params);
    const body = aiBotCreateSchema.parse(request.body);
    const auth = await authContextResolve(request, context, params.orgid);
    await botManagementAuthorize(context, params.orgid, auth.user.id);

    return await idempotencyGuard(request, context, { type: "user", id: auth.user.id }, async () => {
      const bot = await aiBotCreate(context, {
        organizationId: params.orgid,
        username: body.username,
        firstName: body.firstName,
        systemPrompt: body.systemPrompt,
        webhookUrl: body.webhookUrl,
        avatarUrl: body.avatarUrl
      });

      return apiResponseOk({
        bot: aiBotSerialize(bot)
      });
    });
  });

  app.get("/api/org/:orgid/bots", async (request) => {
    const params = z.object({ orgid: z.string().min(1) }).parse(request.params);
    const auth = await authContextResolve(request, context, params.orgid);
    await botManagementAuthorize(context, params.orgid, auth.user.id);

    const bots = await aiBotList(context, {
      organizationId: params.orgid
    });

    return apiResponseOk({
      bots: bots.map(aiBotSerialize)
    });
  });

  app.patch("/api/org/:orgid/bots/:userId", async (request) => {
    const params = z.object({ orgid: z.string().min(1), userId: z.string().min(1) }).parse(request.params);
    const body = aiBotUpdateSchema.parse(request.body);
    const auth = await authContextResolve(request, context, params.orgid);
    await botManagementAuthorize(context, params.orgid, auth.user.id);

    return await idempotencyGuard(request, context, { type: "user", id: auth.user.id }, async () => {
      const bot = await aiBotUpdate(context, {
        organizationId: params.orgid,
        userId: params.userId,
        firstName: body.firstName,
        systemPrompt: body.systemPrompt,
        webhookUrl: body.webhookUrl,
        avatarUrl: body.avatarUrl
      });

      return apiResponseOk({
        bot: aiBotSerialize(bot)
      });
    });
  });
}
