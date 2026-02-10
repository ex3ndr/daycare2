import type { FastifyInstance } from "fastify";
import type { ApiContext } from "../lib/apiContext.js";
import { healthRouteRegister } from "./healthRouteRegister.js";
import { authRoutesRegister } from "./auth/authRoutesRegister.js";
import { orgRoutesRegister } from "./org/orgRoutesRegister.js";
import { channelRoutesRegister } from "./channels/channelRoutesRegister.js";

export async function routesRegister(app: FastifyInstance, context: ApiContext): Promise<void> {
  await healthRouteRegister(app);
  await authRoutesRegister(app, context);
  await orgRoutesRegister(app, context);
  await channelRoutesRegister(app, context);
}
