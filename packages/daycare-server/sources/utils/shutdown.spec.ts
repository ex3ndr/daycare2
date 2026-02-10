import { describe, expect, it, vi } from "vitest";
import { shutdownManagerCreate } from "./shutdown.js";

function loggerStub() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  };
}

describe("shutdownManagerCreate", () => {
  it("runs registered handlers and resolves awaitShutdown", async () => {
    const logger = loggerStub();
    const events: string[] = [];

    const manager = shutdownManagerCreate({
      attachProcessHandlers: false,
      logger,
      forceExitMs: 10_000
    });

    manager.onShutdown("a", async () => {
      events.push("a");
    });

    const shutdownPromise = manager.awaitShutdown();
    manager.requestShutdown("SIGTERM");

    await expect(shutdownPromise).resolves.toBe("SIGTERM");
    expect(events).toEqual(["a"]);
  });

  it("does not run unsubscribed handlers", async () => {
    const logger = loggerStub();
    const events: string[] = [];

    const manager = shutdownManagerCreate({
      attachProcessHandlers: false,
      logger,
      forceExitMs: 10_000
    });

    const unsubscribe = manager.onShutdown("a", async () => {
      events.push("a");
    });
    unsubscribe();

    const shutdownPromise = manager.awaitShutdown();
    manager.requestShutdown("SIGINT");
    await shutdownPromise;

    expect(events).toEqual([]);
  });

  it("isolates handler failures", async () => {
    const logger = loggerStub();
    const events: string[] = [];

    const manager = shutdownManagerCreate({
      attachProcessHandlers: false,
      logger,
      forceExitMs: 10_000
    });

    manager.onShutdown("failing", async () => {
      throw new Error("boom");
    });

    manager.onShutdown("ok", async () => {
      events.push("ok");
    });

    const shutdownPromise = manager.awaitShutdown();
    manager.requestShutdown("fatal");

    await expect(shutdownPromise).resolves.toBe("fatal");
    expect(events).toEqual(["ok"]);
    expect(logger.warn).toHaveBeenCalled();
  });

  it("is idempotent for repeated requestShutdown calls", async () => {
    const logger = loggerStub();
    let runs = 0;

    const manager = shutdownManagerCreate({
      attachProcessHandlers: false,
      logger,
      forceExitMs: 10_000
    });

    manager.onShutdown("a", async () => {
      runs += 1;
    });

    const shutdownPromise = manager.awaitShutdown();
    manager.requestShutdown("SIGTERM");
    manager.requestShutdown("SIGINT");

    await shutdownPromise;

    expect(runs).toBe(1);
  });
});
