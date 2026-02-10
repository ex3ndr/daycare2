import type { FastifyInstance } from "fastify";
import type { ApiContext } from "../lib/apiContext.js";
import { describe, expect, it, vi } from "vitest";

vi.mock("./healthRouteRegister.js", () => ({
  healthRouteRegister: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("./auth/authRoutesRegister.js", () => ({
  authRoutesRegister: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("./org/orgRoutesRegister.js", () => ({
  orgRoutesRegister: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("./channels/channelRoutesRegister.js", () => ({
  channelRoutesRegister: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("./messages/messageRoutesRegister.js", () => ({
  messageRoutesRegister: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("./typing/typingRoutesRegister.js", () => ({
  typingRoutesRegister: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("./read/readRoutesRegister.js", () => ({
  readRoutesRegister: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("./updates/updateRoutesRegister.js", () => ({
  updateRoutesRegister: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("./files/fileRoutesRegister.js", () => ({
  fileRoutesRegister: vi.fn().mockResolvedValue(undefined)
}));

import { authRoutesRegister } from "./auth/authRoutesRegister.js";
import { channelRoutesRegister } from "./channels/channelRoutesRegister.js";
import { fileRoutesRegister } from "./files/fileRoutesRegister.js";
import { healthRouteRegister } from "./healthRouteRegister.js";
import { messageRoutesRegister } from "./messages/messageRoutesRegister.js";
import { orgRoutesRegister } from "./org/orgRoutesRegister.js";
import { readRoutesRegister } from "./read/readRoutesRegister.js";
import { typingRoutesRegister } from "./typing/typingRoutesRegister.js";
import { updateRoutesRegister } from "./updates/updateRoutesRegister.js";
import { routesRegister } from "./_routes.js";

describe("routesRegister", () => {
  it("registers all route groups", async () => {
    const healthRouteRegisterMock = vi.mocked(healthRouteRegister);
    const authRoutesRegisterMock = vi.mocked(authRoutesRegister);
    const orgRoutesRegisterMock = vi.mocked(orgRoutesRegister);
    const channelRoutesRegisterMock = vi.mocked(channelRoutesRegister);
    const messageRoutesRegisterMock = vi.mocked(messageRoutesRegister);
    const typingRoutesRegisterMock = vi.mocked(typingRoutesRegister);
    const readRoutesRegisterMock = vi.mocked(readRoutesRegister);
    const updateRoutesRegisterMock = vi.mocked(updateRoutesRegister);
    const fileRoutesRegisterMock = vi.mocked(fileRoutesRegister);

    const app = {} as FastifyInstance;
    const context = {} as ApiContext;

    await routesRegister(app, context);

    expect(healthRouteRegisterMock).toHaveBeenCalledWith(app);
    expect(authRoutesRegisterMock).toHaveBeenCalledWith(app, context);
    expect(orgRoutesRegisterMock).toHaveBeenCalledWith(app, context);
    expect(channelRoutesRegisterMock).toHaveBeenCalledWith(app, context);
    expect(messageRoutesRegisterMock).toHaveBeenCalledWith(app, context);
    expect(typingRoutesRegisterMock).toHaveBeenCalledWith(app, context);
    expect(readRoutesRegisterMock).toHaveBeenCalledWith(app, context);
    expect(updateRoutesRegisterMock).toHaveBeenCalledWith(app, context);
    expect(fileRoutesRegisterMock).toHaveBeenCalledWith(app, context);
  });
});
