import { z } from "zod";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "./lib/apiError.js";
import { apiCreate } from "./apiCreate.js";
import { testLiveContextCreate } from "@/utils/testLiveContextCreate.js";

type LiveContext = Awaited<ReturnType<typeof testLiveContextCreate>>;

describe("apiCreate", () => {
  let live: LiveContext;

  beforeAll(async () => {
    live = await testLiveContextCreate();
  });

  beforeEach(async () => {
    await live.reset();
  });

  afterAll(async () => {
    await live.close();
  });

  it("maps ApiError, ZodError and internal errors to api envelopes", async () => {
    const app = await apiCreate(live.context);

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

    try {
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
