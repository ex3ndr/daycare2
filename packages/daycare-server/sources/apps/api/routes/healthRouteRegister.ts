import type { FastifyInstance } from "fastify";
import type { ApiContext } from "../lib/apiContext.js";

export async function healthRouteRegister(app: FastifyInstance, context: ApiContext): Promise<void> {
  app.get("/health", async () => {
    return {
      ok: true,
      timestamp: Date.now()
    };
  });

  app.get("/health/ready", async () => {
    const startedAt = Date.now();
    let databaseOk = false;
    let redisOk = false;
    let databaseError: string | null = null;
    let redisError: string | null = null;

    try {
      await context.db.$queryRaw`SELECT 1`;
      databaseOk = true;
    } catch (error) {
      databaseError = String(error);
    }

    try {
      const pong = await context.redis.ping();
      redisOk = pong === "PONG";
      if (!redisOk) {
        redisError = `Unexpected redis response: ${pong}`;
      }
    } catch (error) {
      redisError = String(error);
    }

    return {
      ok: databaseOk && redisOk,
      timestamp: Date.now(),
      checks: {
        database: {
          ok: databaseOk,
          error: databaseError
        },
        redis: {
          ok: redisOk,
          error: redisError
        }
      },
      latencyMs: Date.now() - startedAt
    };
  });
}
