import type { ApiResponse } from "../types";

type ApiRequestArgs = {
  baseUrl: string;
  path: string;
  method?: "GET" | "POST" | "PATCH";
  token?: string | null;
  body?: unknown;
};

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

  const payload = (await response.json()) as ApiResponse<T>;

  if (!payload.ok) {
    const error = new Error(payload.error.message);
    (error as Error & { code?: string }).code = payload.error.code;
    throw error;
  }

  return payload.data;
}
