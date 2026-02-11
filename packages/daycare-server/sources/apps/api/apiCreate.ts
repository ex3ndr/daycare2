import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import type { ApiContext } from "./lib/apiContext.js";
import { ApiError } from "./lib/apiError.js";
import { apiResponseFail } from "./lib/apiResponseFail.js";
import { routesRegister } from "./routes/_routes.js";

export async function apiCreate(context: ApiContext): Promise<FastifyInstance> {
  const app = Fastify({
    logger: true
  });

  await app.register(cors, {
    origin: "*"
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) {
      return reply.status(error.statusCode).send(apiResponseFail(error.code, error.message, error.details));
    }

    if (error instanceof ZodError) {
      return reply.status(400).send(apiResponseFail("VALIDATION_ERROR", error.message));
    }

    app.log.error(error);
    return reply.status(500).send(apiResponseFail("INTERNAL_ERROR", "Unexpected server error"));
  });

  await routesRegister(app, context);

  return app;
}
