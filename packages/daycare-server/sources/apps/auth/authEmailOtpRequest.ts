import { createHash } from "node:crypto";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { ApiError } from "@/apps/api/lib/apiError.js";
import { authOtpCodeCreate } from "@/apps/auth/authOtpCodeCreate.js";
import { authOtpCodeHash } from "@/apps/auth/authOtpCodeHash.js";

export type AuthEmailOtpRequestResult = {
  sent: boolean;
  expiresInSeconds: number;
};

type AuthEmailOtpRequestInput = {
  email: string;
};

export async function authEmailOtpRequest(
  context: ApiContext,
  input: AuthEmailOtpRequestInput
): Promise<AuthEmailOtpRequestResult> {
  const email = input.email.trim().toLowerCase();
  const keySuffix = createHash("sha256").update(email).digest("hex");
  const otpKey = `otp:${keySuffix}`;
  const attemptsKey = `otp:${keySuffix}:attempts`;
  const cooldownKey = `otp:${keySuffix}:cooldown`;

  const cooldownResult = await context.redis.set(
    cooldownKey,
    "1",
    "EX",
    context.otp.cooldownSeconds,
    "NX"
  );

  if (!cooldownResult) {
    throw new ApiError(429, "RATE_LIMITED", "OTP recently requested. Please wait before retrying.");
  }

  const code = authOtpCodeCreate();
  const hashed = authOtpCodeHash(code, context.otp.salt);
  const isStaticTestEmail = (
    context.otp.testStatic.enabled
    && email === context.otp.testStatic.email
  );

  await context.redis.set(otpKey, hashed, "EX", context.otp.ttlSeconds);
  await context.redis.del(attemptsKey);

  if (!isStaticTestEmail) {
    try {
      const minutes = Math.ceil(context.otp.ttlSeconds / 60);
      await context.email.send({
        to: email,
        subject: "Your daycare login code",
        text: `Your daycare login code is ${code}. It expires in ${minutes} minutes.`,
        html: `Your daycare login code is <strong>${code}</strong>. It expires in ${minutes} minutes.`
      });
    } catch (error) {
      await context.redis.del(otpKey, attemptsKey, cooldownKey);
      throw new ApiError(502, "EMAIL_FAILED", "Failed to deliver OTP email");
    }
  }

  return {
    sent: true,
    expiresInSeconds: context.otp.ttlSeconds
  };
}
