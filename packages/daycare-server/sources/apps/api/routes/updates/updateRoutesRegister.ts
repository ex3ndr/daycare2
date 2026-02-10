import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { authContextResolve } from "@/apps/api/lib/authContextResolve.js";
import { apiResponseOk } from "@/apps/api/lib/apiResponseOk.js";

const diffBodySchema = z.object({
  offset: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(500).default(200)
});

export async function updateRoutesRegister(app: FastifyInstance, context: ApiContext): Promise<void> {
  app.post("/api/org/:orgid/updates/diff", async (request) => {
    const params = z.object({ orgid: z.string().min(1) }).parse(request.params);
    const body = diffBodySchema.parse(request.body);
    const auth = await authContextResolve(request, context, params.orgid);

    const diff = await context.updates.diffGet(auth.user.id, body.offset, body.limit);

    return apiResponseOk(diff);
  });

  app.get("/api/org/:orgid/updates/stream", async (request, reply) => {
    const params = z.object({ orgid: z.string().min(1) }).parse(request.params);
    const auth = await authContextResolve(request, context, params.orgid);

    reply.hijack();
    const unsubscribe = context.updates.subscribe(auth.user.id, params.orgid, reply);

    const interval = setInterval(() => {
      reply.raw.write("event: ping\ndata: {}\n\n");
    }, 15_000);

    request.raw.on("close", () => {
      clearInterval(interval);
      unsubscribe();
    });
  });
}
