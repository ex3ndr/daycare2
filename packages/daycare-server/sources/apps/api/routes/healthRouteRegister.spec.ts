import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import type { ApiContext } from "../lib/apiContext.js";
import { healthRouteRegister } from "./healthRouteRegister.js";

describe("healthRouteRegister", () => {
  it("registers health endpoint", async () => {
    const app = Fastify();
    const context = {
      db: {
        $queryRaw: vi.fn().mockResolvedValue([{ ok: 1 }])
      },
      redis: {
        ping: vi.fn().mockResolvedValue("PONG")
      }
    } as unknown as ApiContext;

    await healthRouteRegister(app, context);

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

    const readyResponse = await app.inject({
      method: "GET",
      url: "/health/ready"
    });
    expect(readyResponse.statusCode).toBe(200);

    const readyPayload = readyResponse.json() as {
      ok: boolean;
      latencyMs: number;
      checks: {
        database: { ok: boolean };
        redis: { ok: boolean };
      };
    };
    expect(readyPayload.ok).toBe(true);
    expect(readyPayload.checks.database.ok).toBe(true);
    expect(readyPayload.checks.redis.ok).toBe(true);
    expect(typeof readyPayload.latencyMs).toBe("number");

    await app.close();
  });
});
