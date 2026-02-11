import type { ApiResponse } from "../types";

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

type ApiRequestArgs = {
  baseUrl: string;
  path: string;
  method?: "GET" | "POST" | "PATCH";
  token?: string | null;
  body?: unknown;
};

let onUnauthorized: (() => void) | null = null;

export function apiRequestSetUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

export async function apiRequest<T>({ baseUrl, path, method = "GET", token, body }: ApiRequestArgs): Promise<T> {
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

  let payload: ApiResponse<T>;
  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    throw new ApiError(`HTTP ${response.status}`, "HTTP_ERROR", response.status);
  }

  if (!payload.ok) {
    throw new ApiError(payload.error.message, payload.error.code, response.status);
  }

  return payload.data;
}
