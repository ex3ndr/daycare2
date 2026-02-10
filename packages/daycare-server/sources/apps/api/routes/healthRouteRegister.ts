import type { FastifyInstance } from "fastify";

export async function healthRouteRegister(app: FastifyInstance): Promise<void> {
  app.get("/health", async () => {
    return {
      ok: true,
      timestamp: Date.now()
    };
  });
}
