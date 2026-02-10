import type { FastifyInstance } from "fastify";

export async function apiStop(app: FastifyInstance): Promise<void> {
  await app.close();
}
