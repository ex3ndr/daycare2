import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn()
}));

import { lookup } from "node:dns/promises";
import { aiBotWebhookDeliver } from "./aiBotWebhookDeliver.js";

describe("aiBotWebhookDeliver", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(lookup).mockResolvedValue([{
      address: "93.184.216.34",
      family: 4
    }] as any);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("delivers webhook successfully on first attempt", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200
    } as Response);

    const delivered = await aiBotWebhookDeliver({
      webhookUrl: "https://example.com/webhook",
      payload: { event: "message.created" }
    });

    expect(delivered).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries once after a failure", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({
        ok: true,
        status: 200
      } as Response);

    const promise = aiBotWebhookDeliver({
      webhookUrl: "https://example.com/webhook",
      payload: { event: "message.created" }
    });

    await vi.advanceTimersByTimeAsync(5_000);
    const delivered = await promise;

    expect(delivered).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns false after retry failure", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("network"))
      .mockRejectedValueOnce(new Error("network"));

    const promise = aiBotWebhookDeliver({
      webhookUrl: "https://example.com/webhook",
      payload: { event: "message.created" }
    });

    await vi.advanceTimersByTimeAsync(5_000);
    const delivered = await promise;

    expect(delivered).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects disallowed webhook URLs", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200
    } as Response);

    const delivered = await aiBotWebhookDeliver({
      webhookUrl: "https://127.0.0.1/internal",
      payload: { event: "message.created" }
    });

    expect(delivered).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects webhook URLs that resolve to private addresses", async () => {
    vi.mocked(lookup).mockResolvedValueOnce([{
      address: "127.0.0.1",
      family: 4
    }] as any);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200
    } as Response);

    const delivered = await aiBotWebhookDeliver({
      webhookUrl: "https://example.com/webhook",
      payload: { event: "message.created" }
    });

    expect(delivered).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects ipv4-mapped ipv6 private addresses in hex form", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200
    } as Response);

    const delivered = await aiBotWebhookDeliver({
      webhookUrl: "https://[::ffff:7f00:1]/webhook",
      payload: { event: "message.created" }
    });

    expect(delivered).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects redirect responses", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 302
    } as Response);

    const promise = aiBotWebhookDeliver({
      webhookUrl: "https://example.com/webhook",
      payload: { event: "message.created" }
    });

    await vi.advanceTimersByTimeAsync(5_000);
    const delivered = await promise;

    expect(delivered).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
