import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ApiContext } from "./lib/apiContext.js";
import { ApiError } from "./lib/apiError.js";
import { describe, expect, it, vi } from "vitest";

vi.mock("./routes/_routes.js", () => ({
  routesRegister: vi.fn(async (app: FastifyInstance) => {
    app.get("/throw/api-error", async () => {
      throw new ApiError(418, "TEAPOT", "short and stout", { kettle: true });
    });

    app.get("/throw/zod-error", async () => {
      z.object({
        message: z.string()
      }).parse({});
      return {};
    });

    app.get("/throw/internal-error", async () => {
      throw new Error("boom");
    });
  })
}));

import { routesRegister } from "./routes/_routes.js";
import { apiCreate } from "./apiCreate.js";

describe("apiCreate", () => {
  it("registers routes and maps errors to api envelopes", async () => {
    const routesRegisterMock = vi.mocked(routesRegister);
    const context = {} as ApiContext;
    const app = await apiCreate(context);

    try {
      expect(routesRegisterMock).toHaveBeenCalledWith(expect.anything(), context);

      const apiErrorResponse = await app.inject({
        method: "GET",
        url: "/throw/api-error"
      });
      expect(apiErrorResponse.statusCode).toBe(418);
      expect(apiErrorResponse.json()).toEqual({
        ok: false,
        error: {
          code: "TEAPOT",
          message: "short and stout",
          details: {
            kettle: true
          }
        }
      });

      const zodErrorResponse = await app.inject({
        method: "GET",
        url: "/throw/zod-error"
      });
      expect(zodErrorResponse.statusCode).toBe(400);
      expect(zodErrorResponse.json()).toMatchObject({
        ok: false,
        error: {
          code: "VALIDATION_ERROR"
        }
      });

      const internalErrorResponse = await app.inject({
        method: "GET",
        url: "/throw/internal-error"
      });
      expect(internalErrorResponse.statusCode).toBe(500);
      expect(internalErrorResponse.json()).toEqual({
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Unexpected server error",
          details: undefined
        }
      });
    } finally {
      await app.close();
    }
  });
});
