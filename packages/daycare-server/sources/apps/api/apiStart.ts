import type { FastifyInstance } from "fastify";

export async function apiStart(app: FastifyInstance, host: string, port: number): Promise<void> {
  await app.listen({
    host,
    port
  });
}
