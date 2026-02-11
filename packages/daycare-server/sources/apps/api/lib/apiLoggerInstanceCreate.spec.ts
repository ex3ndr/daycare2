import { afterEach, describe, expect, it, vi } from "vitest";
import { apiLoggerInstanceCreate } from "./apiLoggerInstanceCreate.js";

describe("apiLoggerInstanceCreate", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs fastify object+message calls with module label", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const logger = apiLoggerInstanceCreate("server.api");
    const meta = {
      req: {
        method: "GET",
        url: "/api/test"
      }
    };

    logger.info(meta, "incoming request");

    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining("[server.api"), meta);
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining("incoming request"), meta);
  });

  it("creates child loggers with reqId suffix when available", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const logger = apiLoggerInstanceCreate("server.api");
    const child = logger.child({
      reqId: "req-42"
    });

    child.info("request completed");

    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining("[server.api.req-42"));
  });
});
