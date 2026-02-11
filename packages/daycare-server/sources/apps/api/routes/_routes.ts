import type { FastifyInstance } from "fastify";
import type { ApiContext } from "../lib/apiContext.js";
import { healthRouteRegister } from "./healthRouteRegister.js";
import { authRoutesRegister } from "./auth/authRoutesRegister.js";
import { orgRoutesRegister } from "./org/orgRoutesRegister.js";
import { channelRoutesRegister } from "./channels/channelRoutesRegister.js";
import { messageRoutesRegister } from "./messages/messageRoutesRegister.js";
import { typingRoutesRegister } from "./typing/typingRoutesRegister.js";
import { readRoutesRegister } from "./read/readRoutesRegister.js";
import { updateRoutesRegister } from "./updates/updateRoutesRegister.js";
import { fileRoutesRegister } from "./files/fileRoutesRegister.js";
import { presenceRoutesRegister } from "./presence/presenceRoutesRegister.js";
import { searchRoutesRegister } from "./search/searchRoutesRegister.js";
import { aiRoutesRegister } from "./ai/aiRoutesRegister.js";

export async function routesRegister(app: FastifyInstance, context: ApiContext): Promise<void> {
  await healthRouteRegister(app, context);
  await authRoutesRegister(app, context);
  await orgRoutesRegister(app, context);
  await channelRoutesRegister(app, context);
  await messageRoutesRegister(app, context);
  await typingRoutesRegister(app, context);
  await readRoutesRegister(app, context);
  await updateRoutesRegister(app, context);
  await fileRoutesRegister(app, context);
  await presenceRoutesRegister(app, context);
  await searchRoutesRegister(app, context);
  await aiRoutesRegister(app, context);
}
