import { afterEach, describe, expect, it, vi } from "vitest";
import { getLogger } from "./getLogger.js";

describe("getLogger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("pads module labels to fixed width", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const logger = getLogger("api");

    logger.info("started");

    expect(info).toHaveBeenCalledTimes(1);
    const firstArg = info.mock.calls[0]?.[0];
    expect(String(firstArg)).toContain("[api                 ] started");
  });

  it("trims long module labels", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const logger = getLogger("this.module.name.is.longer.than.twenty");

    logger.warn("warning");

    expect(warn).toHaveBeenCalledTimes(1);
    const firstArg = warn.mock.calls[0]?.[0];
    expect(String(firstArg)).toContain("[this.module.name.is.] warning");
  });

  it("uses unknown label for blank module names", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const logger = getLogger("   ");

    logger.info("ready");

    expect(info).toHaveBeenCalledTimes(1);
    const firstArg = info.mock.calls[0]?.[0];
    expect(String(firstArg)).toContain("[unknown             ] ready");
  });

  it("logs debug with metadata", () => {
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
    const logger = getLogger("api");

    logger.debug("boot", { ok: true });

    expect(debug).toHaveBeenCalledTimes(1);
    expect(debug.mock.calls[0]?.[1]).toEqual({ ok: true });
  });

  it("logs error without metadata", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const logger = getLogger("api");

    logger.error("boom");

    expect(error).toHaveBeenCalledTimes(1);
    const firstArg = error.mock.calls[0]?.[0];
    expect(String(firstArg)).toContain("boom");
  });
});
