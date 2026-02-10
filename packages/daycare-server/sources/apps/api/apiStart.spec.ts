import Fastify, { type FastifyInstance } from "fastify";
import { describe, expect, it, vi } from "vitest";
import { apiStart } from "./apiStart.js";

describe("apiStart", () => {
  it("delegates listen call with host and port", async () => {
    const listen = vi.fn().mockResolvedValue(undefined);
    const app = {
      listen
    } as unknown as FastifyInstance;

    await apiStart(app, "0.0.0.0", 4100);

    expect(listen).toHaveBeenCalledWith({
      host: "0.0.0.0",
      port: 4100
    });
  });

  it("starts multiple servers in parallel", async () => {
    const appA = Fastify();
    const appB = Fastify();

    await Promise.all([
      apiStart(appA, "127.0.0.1", 0),
      apiStart(appB, "127.0.0.1", 0)
    ]);

    const addressA = appA.server.address();
    const addressB = appB.server.address();

    expect(addressA && typeof addressA !== "string").toBe(true);
    expect(addressB && typeof addressB !== "string").toBe(true);

    await Promise.all([appA.close(), appB.close()]);
  });
});
