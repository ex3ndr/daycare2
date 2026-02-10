import type { FastifyRequest } from "fastify";
import { ApiError } from "./apiError.js";

export function authTokenExtract(request: FastifyRequest): string {
  const header = request.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    throw new ApiError(401, "UNAUTHORIZED", "Missing bearer token");
  }

  return header.slice("Bearer ".length).trim();
}
