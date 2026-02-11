import { describe, expect, it } from "vitest";
import { aiBotWebhookDeliver } from "./aiBotWebhookDeliver.js";

describe("aiBotWebhookDeliver", () => {
  it("rejects non-https webhook URLs", async () => {
    const delivered = await aiBotWebhookDeliver({
      webhookUrl: "http://example.com/webhook",
      payload: { event: "message.created" }
    });

    expect(delivered).toBe(false);
  });

  it("rejects localhost webhook URLs", async () => {
    const delivered = await aiBotWebhookDeliver({
      webhookUrl: "https://localhost/webhook",
      payload: { event: "message.created" }
    });

    expect(delivered).toBe(false);
  });

  it("rejects private IPv4 webhook URLs", async () => {
    const delivered = await aiBotWebhookDeliver({
      webhookUrl: "https://127.0.0.1/internal",
      payload: { event: "message.created" }
    });

    expect(delivered).toBe(false);
  });

  it("rejects ipv4-mapped ipv6 private addresses in hex form", async () => {
    const delivered = await aiBotWebhookDeliver({
      webhookUrl: "https://[::ffff:7f00:1]/webhook",
      payload: { event: "message.created" }
    });

    expect(delivered).toBe(false);
  });
});
