import type { FastifyRequest } from "fastify";
import { describe, expect, it } from "vitest";
import { ApiError } from "./apiError.js";
import { authTokenExtract } from "./authTokenExtract.js";

function requestCreate(authorization?: string): FastifyRequest {
  return {
    headers: authorization ? { authorization } : {}
  } as FastifyRequest;
}

describe("authTokenExtract", () => {
  it("extracts and trims bearer token", () => {
    expect(authTokenExtract(requestCreate("Bearer   token-123   "))).toBe("token-123");
  });

  it("throws when authorization header is missing", () => {
    expect(() => authTokenExtract(requestCreate())).toThrowError(ApiError);
    expect(() => authTokenExtract(requestCreate())).toThrow("Missing bearer token");
  });

  it("throws when authorization header is not a bearer token", () => {
    expect(() => authTokenExtract(requestCreate("Basic abc"))).toThrowError(ApiError);
  });
});
