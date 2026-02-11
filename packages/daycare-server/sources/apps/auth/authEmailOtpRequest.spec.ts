import { createHash } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/apps/api/lib/apiError.js";
import { testLiveContextCreate } from "@/utils/testLiveContextCreate.js";
import { authEmailOtpRequest } from "./authEmailOtpRequest.js";

type LiveContext = Awaited<ReturnType<typeof testLiveContextCreate>>;

describe("authEmailOtpRequest", () => {
  let live: LiveContext;

  beforeAll(async () => {
    live = await testLiveContextCreate();
  });

  beforeEach(async () => {
    await live.reset();
  });

  afterAll(async () => {
    await live.close();
  });

  it("stores OTP hash and reports success", async () => {
    const email = "User@Example.com";

    const result = await authEmailOtpRequest(live.context, { email });

    expect(result.sent).toBe(true);

    const keySuffix = createHash("sha256").update("user@example.com").digest("hex");
    const stored = await live.redis.get(`otp:${keySuffix}`);
    expect(stored).toMatch(/^[a-f0-9]{64}$/);
  });

  it("enforces cooldown", async () => {
    await authEmailOtpRequest(live.context, { email: "user@example.com" });

    const result = authEmailOtpRequest(live.context, { email: "user@example.com" });
    await expect(result).rejects.toBeInstanceOf(ApiError);
    await expect(result).rejects.toMatchObject({ statusCode: 429 });
  });

  it("cleans up redis keys when email sending fails", async () => {
    const email = "user@example.com";
    const keySuffix = createHash("sha256").update(email).digest("hex");

    const context = {
      ...live.context,
      email: {
        send: async () => {
          throw new Error("fail");
        }
      }
    };

    const result = authEmailOtpRequest(context, { email });
    await expect(result).rejects.toBeInstanceOf(ApiError);
    await expect(result).rejects.toMatchObject({ statusCode: 502 });

    expect(await live.redis.get(`otp:${keySuffix}`)).toBeNull();
    expect(await live.redis.get(`otp:${keySuffix}:cooldown`)).toBeNull();
  });

  it("does not send email for static integration email when enabled", async () => {
    const emailSend = vi.fn().mockResolvedValue(undefined);
    const email = live.context.otp.testStatic.email;
    const keySuffix = createHash("sha256").update(email).digest("hex");

    const context = {
      ...live.context,
      otp: {
        ...live.context.otp,
        testStatic: {
          ...live.context.otp.testStatic,
          enabled: true
        }
      },
      email: {
        send: emailSend
      }
    };

    const result = await authEmailOtpRequest(context, { email });

    expect(result.sent).toBe(true);
    const stored = await live.redis.get(`otp:${keySuffix}`);
    expect(stored).toMatch(/^[a-f0-9]{64}$/);
    expect(emailSend).not.toHaveBeenCalled();
  });
});
