import { z } from "zod";

export class ApiError extends Error {
  code?: string;
  httpStatus?: number;

  constructor(message: string, code?: string, httpStatus?: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

type ApiRequestArgs<T> = {
  baseUrl: string;
  path: string;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  token?: string | null;
  body?: unknown;
  schema: z.ZodType<T>;
};

let onUnauthorized: (() => void) | null = null;
let onDeactivated: (() => void) | null = null;
let deactivationFired = false;

export function apiRequestSetUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

export function apiRequestFireUnauthorized() {
  onUnauthorized?.();
}

export function apiRequestSetDeactivatedHandler(handler: () => void) {
  onDeactivated = handler;
  deactivationFired = false;
}

export function apiRequestFireDeactivated() {
  if (deactivationFired) return;
  deactivationFired = true;
  onDeactivated?.();
}

export async function apiRequest<T>({
  baseUrl,
  path,
  method = "GET",
  token,
  body,
  schema,
}: ApiRequestArgs<T>): Promise<T> {
  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
  const hasBody = body !== undefined;
  if (hasBody) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: hasBody ? JSON.stringify(body) : undefined
  });

  if (response.status === 401) {
    onUnauthorized?.();
    throw new ApiError("Session expired", "UNAUTHORIZED", 401);
  }

  let payloadRaw: unknown;
  try {
    payloadRaw = await response.json();
  } catch {
    throw new ApiError(`HTTP ${response.status}`, "HTTP_ERROR", response.status);
  }

  const successPayloadSchema = z.object({
    ok: z.literal(true),
    data: schema,
  });
  const errorPayloadSchema = z.object({
    ok: z.literal(false),
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.record(z.string(), z.unknown()).optional(),
    }),
  });

  const successPayload = successPayloadSchema.safeParse(payloadRaw);
  if (successPayload.success) {
    return successPayload.data.data as T;
  }

  const errorPayload = errorPayloadSchema.safeParse(payloadRaw);
  if (errorPayload.success) {
    // Detect deactivation: 403 with message containing "deactivated"
    if (response.status === 403 && errorPayload.data.error.message?.toLowerCase().includes("deactivated")) {
      apiRequestFireDeactivated();
    }
    throw new ApiError(errorPayload.data.error.message, errorPayload.data.error.code, response.status);
  }

  throw new ApiError(
    `Invalid response envelope: ${successPayload.error.issues[0]?.message ?? "schema mismatch"}`,
    "INVALID_RESPONSE",
    response.status,
  );
}
