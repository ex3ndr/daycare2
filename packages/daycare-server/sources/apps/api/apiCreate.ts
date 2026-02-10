import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { healthRouteRegister } from "./routes/healthRouteRegister.js";

export async function apiCreate(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: true
  });

  await app.register(cors, {
    origin: true
  });
  await healthRouteRegister(app);

  return app;
}
