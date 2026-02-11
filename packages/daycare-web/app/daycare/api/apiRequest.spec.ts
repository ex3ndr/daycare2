import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiRequest, ApiError, apiRequestSetUnauthorizedHandler, apiRequestSetDeactivatedHandler } from "./apiRequest";

describe("apiRequest", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    apiRequestSetUnauthorizedHandler(() => {});
    apiRequestSetDeactivatedHandler(() => {});
  });

  it("returns data on successful response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({ ok: true, data: { id: "1" } }),
    });

    const result = await apiRequest<{ id: string }>({
      baseUrl: "http://test",
      path: "/api/test",
    });

    expect(result).toEqual({ id: "1" });
  });

  it("throws ApiError with code on API error", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 400,
      json: () =>
        Promise.resolve({ ok: false, error: { message: "Bad input", code: "VALIDATION" } }),
    });

    try {
      await apiRequest({ baseUrl: "http://test", path: "/api/test" });
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.message).toBe("Bad input");
      expect(apiErr.code).toBe("VALIDATION");
      expect(apiErr.httpStatus).toBe(400);
    }
  });

  it("calls unauthorized handler and throws on 401", async () => {
    const handler = vi.fn();
    apiRequestSetUnauthorizedHandler(handler);

    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 401,
      json: () =>
        Promise.resolve({ ok: false, error: { message: "Unauthorized", code: "UNAUTHORIZED" } }),
    });

    try {
      await apiRequest({ baseUrl: "http://test", path: "/api/test", token: "expired" });
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).httpStatus).toBe(401);
    }

    expect(handler).toHaveBeenCalledOnce();
  });

  it("does not call unauthorized handler on non-401 errors", async () => {
    const handler = vi.fn();
    apiRequestSetUnauthorizedHandler(handler);

    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 500,
      json: () =>
        Promise.resolve({ ok: false, error: { message: "Server error", code: "INTERNAL" } }),
    });

    try {
      await apiRequest({ baseUrl: "http://test", path: "/api/test" });
    } catch {
      // expected
    }

    expect(handler).not.toHaveBeenCalled();
  });

  it("sends authorization header when token provided", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({ ok: true, data: {} }),
    });

    await apiRequest({ baseUrl: "http://test", path: "/api/test", token: "mytoken" });

    const [, opts] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(opts.headers.Authorization).toBe("Bearer mytoken");
  });

  it("sends JSON body for POST requests", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({ ok: true, data: {} }),
    });

    await apiRequest({
      baseUrl: "http://test",
      path: "/api/test",
      method: "POST",
      body: { key: "value" },
    });

    const [, opts] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(opts.headers["Content-Type"]).toBe("application/json");
    expect(opts.body).toBe('{"key":"value"}');
  });

  it("calls deactivated handler on 403 with deactivated message", async () => {
    const handler = vi.fn();
    apiRequestSetDeactivatedHandler(handler);

    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 403,
      json: () =>
        Promise.resolve({ ok: false, error: { message: "Account has been deactivated", code: "FORBIDDEN" } }),
    });

    try {
      await apiRequest({ baseUrl: "http://test", path: "/api/test", token: "tok" });
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).httpStatus).toBe(403);
    }

    expect(handler).toHaveBeenCalledOnce();
  });

  it("does not call deactivated handler on 403 without deactivated message", async () => {
    const handler = vi.fn();
    apiRequestSetDeactivatedHandler(handler);

    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 403,
      json: () =>
        Promise.resolve({ ok: false, error: { message: "Forbidden", code: "FORBIDDEN" } }),
    });

    try {
      await apiRequest({ baseUrl: "http://test", path: "/api/test", token: "tok" });
    } catch {
      // expected
    }

    expect(handler).not.toHaveBeenCalled();
  });

  it("does not call deactivated handler on non-403 errors", async () => {
    const handler = vi.fn();
    apiRequestSetDeactivatedHandler(handler);

    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 500,
      json: () =>
        Promise.resolve({ ok: false, error: { message: "Account has been deactivated", code: "INTERNAL" } }),
    });

    try {
      await apiRequest({ baseUrl: "http://test", path: "/api/test" });
    } catch {
      // expected
    }

    expect(handler).not.toHaveBeenCalled();
  });
});
