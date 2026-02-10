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
});
