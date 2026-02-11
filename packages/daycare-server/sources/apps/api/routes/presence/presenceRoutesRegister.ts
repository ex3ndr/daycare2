import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { ApiError } from "@/apps/api/lib/apiError.js";
import { apiResponseOk } from "@/apps/api/lib/apiResponseOk.js";
import { authContextResolve } from "@/apps/api/lib/authContextResolve.js";
import { idempotencyGuard } from "@/apps/api/lib/idempotencyGuard.js";
import { presenceGet } from "@/apps/users/presenceGet.js";
import { presenceHeartbeat } from "@/apps/users/presenceHeartbeat.js";
import { presenceSet } from "@/apps/users/presenceSet.js";

const MAX_PRESENCE_QUERY_IDS = 100;

const presenceSetSchema = z.object({
  status: z.enum(["online", "away"])
});

const presenceQuerySchema = z.object({
  userIds: z.string().trim().min(1)
});

function userIdsParse(value: string): string[] {
  const userIds = Array.from(new Set(
    value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
  ));

  if (userIds.length > MAX_PRESENCE_QUERY_IDS) {
    throw new ApiError(400, "VALIDATION_ERROR", "Too many userIds requested");
  }

  return userIds;
}

export async function presenceRoutesRegister(app: FastifyInstance, context: ApiContext): Promise<void> {
  app.post("/api/org/:orgid/presence", async (request) => {
    const params = z.object({ orgid: z.string().min(1) }).parse(request.params);
    const body = presenceSetSchema.parse(request.body);
    const auth = await authContextResolve(request, context, params.orgid);

    return await idempotencyGuard(request, context, { type: "user", id: auth.user.id }, async () => {
      const status = await presenceSet(context, {
        organizationId: params.orgid,
        userId: auth.user.id,
        status: body.status
      });

      return apiResponseOk({
        presence: {
          userId: auth.user.id,
          status
        }
      });
    });
  });

  app.post("/api/org/:orgid/presence/heartbeat", async (request) => {
    const params = z.object({ orgid: z.string().min(1) }).parse(request.params);
    const auth = await authContextResolve(request, context, params.orgid);

    return await idempotencyGuard(request, context, { type: "user", id: auth.user.id }, async () => {
      const status = await presenceHeartbeat(context, {
        organizationId: params.orgid,
        userId: auth.user.id
      });

      return apiResponseOk({
        presence: {
          userId: auth.user.id,
          status
        }
      });
    });
  });

  app.get("/api/org/:orgid/presence", async (request) => {
    const params = z.object({ orgid: z.string().min(1) }).parse(request.params);
    const query = presenceQuerySchema.parse(request.query);
    const auth = await authContextResolve(request, context, params.orgid);

    const presence = await presenceGet(context, {
      organizationId: params.orgid,
      userIds: userIdsParse(query.userIds)
    });

    return apiResponseOk({
      requesterUserId: auth.user.id,
      presence
    });
  });
}
