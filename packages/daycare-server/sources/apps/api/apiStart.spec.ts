import type { FastifyInstance } from "fastify";
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
});
