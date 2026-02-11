import { afterEach, describe, expect, it, vi } from "vitest";
import { emailServiceCreate } from "./emailServiceCreate.js";

describe("emailServiceCreate", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("throws when config missing in production", () => {
    expect(() => emailServiceCreate({ nodeEnv: "production" })).toThrow("Resend credentials are required");
  });

  it("no-ops in development without credentials", async () => {
    const service = emailServiceCreate({ nodeEnv: "development" });
    await expect(service.send({
      to: "user@example.com",
      subject: "Test",
      html: "<b>Test</b>",
      text: "Test"
    })).resolves.toBeUndefined();
  });

  it("sends with Resend credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => ""
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const service = emailServiceCreate({
      nodeEnv: "production",
      apiKey: "key",
      from: "Daycare <no-reply@daycare.local>"
    });

    await service.send({
      to: "user@example.com",
      subject: "Test",
      html: "<b>Test</b>",
      text: "Test"
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
