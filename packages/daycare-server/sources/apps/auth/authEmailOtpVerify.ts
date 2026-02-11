import { createHash } from "node:crypto";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { ApiError } from "@/apps/api/lib/apiError.js";
import { authLogin } from "@/apps/auth/authLogin.js";
import { authOtpCodeHash } from "@/apps/auth/authOtpCodeHash.js";

const OTP_VERIFY_SCRIPT = `
local otpKey = KEYS[1]
local attemptsKey = KEYS[2]
local provided = ARGV[1]
local maxAttempts = tonumber(ARGV[2])
local ttl = tonumber(ARGV[3])

local stored = redis.call("GET", otpKey)
if not stored then
  return {0, "missing"}
end

local attempts = tonumber(redis.call("GET", attemptsKey) or "0")
if attempts >= maxAttempts then
  return {0, "locked"}
end

if stored ~= provided then
  attempts = redis.call("INCR", attemptsKey)
  if attempts == 1 then
    redis.call("EXPIRE", attemptsKey, ttl)
  end
  if attempts >= maxAttempts then
    return {0, "locked"}
  end
  return {0, "mismatch"}
end

redis.call("DEL", otpKey)
redis.call("DEL", attemptsKey)
return {1, "ok"}
`;

type AuthEmailOtpVerifyInput = {
  email: string;
  code: string;
};

export async function authEmailOtpVerify(
  context: ApiContext,
  input: AuthEmailOtpVerifyInput
): Promise<Awaited<ReturnType<typeof authLogin>>> {
  const email = input.email.trim().toLowerCase();
  const code = input.code.trim();

  const keySuffix = createHash("sha256").update(email).digest("hex");
  const otpKey = `otp:${keySuffix}`;
  const attemptsKey = `otp:${keySuffix}:attempts`;
  const hashed = authOtpCodeHash(code, context.otp.salt);

  const result = await context.redis.eval(
    OTP_VERIFY_SCRIPT,
    2,
    otpKey,
    attemptsKey,
    hashed,
    String(context.otp.maxAttempts),
    String(context.otp.ttlSeconds)
  );

  const [ok, status] = result as [number, string];
  if (ok === 1 && status === "ok") {
    return await authLogin(context, email);
  }

  if (status === "missing") {
    throw new ApiError(400, "VALIDATION_ERROR", "OTP has expired or is invalid");
  }

  if (status === "locked") {
    throw new ApiError(429, "RATE_LIMITED", "OTP attempts exceeded. Request a new code.");
  }

  throw new ApiError(400, "VALIDATION_ERROR", "OTP is invalid");
}
