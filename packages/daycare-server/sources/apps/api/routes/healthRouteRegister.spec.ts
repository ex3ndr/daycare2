import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { healthRouteRegister } from "./healthRouteRegister.js";

describe("healthRouteRegister", () => {
  it("registers health endpoint", async () => {
    const app = Fastify();
    await healthRouteRegister(app);

    const response = await app.inject({
      method: "GET",
      url: "/health"
    });

    expect(response.statusCode).toBe(200);

    const payload = response.json() as {
      ok: boolean;
      timestamp: number;
    };
    expect(payload.ok).toBe(true);
    expect(typeof payload.timestamp).toBe("number");

    await app.close();
  });
});
