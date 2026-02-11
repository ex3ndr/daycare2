import { z } from "zod";

const configSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().min(1).default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3005),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  TOKEN_SERVICE: z.string().min(2).default("daycare"),
  TOKEN_SEED: z.string().min(16),
  ALLOW_OPEN_ORG_JOIN: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM: z.string().optional(),
  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(600),
  OTP_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(60),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  OTP_SALT: z.string().optional(),
  S3_ENDPOINT: z.string().url().default("http://localhost:9000"),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1).default("daycare"),
  S3_FORCE_PATH_STYLE: z.enum(["true", "false"]).default("true")
});

export type DaycareConfig = {
  nodeEnv: "development" | "test" | "production";
  host: string;
  port: number;
  databaseUrl: string;
  redisUrl: string;
  tokenService: string;
  tokenSeed: string;
  allowOpenOrgJoin: boolean;
  resendApiKey?: string;
  resendFrom?: string;
  otpTtlSeconds: number;
  otpCooldownSeconds: number;
  otpMaxAttempts: number;
  otpSalt: string;
  s3Endpoint: string;
  s3AccessKey: string;
  s3SecretKey: string;
  s3Bucket: string;
  s3ForcePathStyle: boolean;
};

export function configRead(env: NodeJS.ProcessEnv = process.env): DaycareConfig {
  const parsed = configSchema.parse(env);
  const allowOpenOrgJoin = parsed.ALLOW_OPEN_ORG_JOIN
    ? parsed.ALLOW_OPEN_ORG_JOIN === "true"
    : parsed.NODE_ENV !== "production";

  return {
    nodeEnv: parsed.NODE_ENV,
    host: parsed.HOST,
    port: parsed.PORT,
    databaseUrl: parsed.DATABASE_URL,
    redisUrl: parsed.REDIS_URL,
    tokenService: parsed.TOKEN_SERVICE,
    tokenSeed: parsed.TOKEN_SEED,
    allowOpenOrgJoin,
    resendApiKey: parsed.RESEND_API_KEY,
    resendFrom: parsed.RESEND_FROM,
    otpTtlSeconds: parsed.OTP_TTL_SECONDS,
    otpCooldownSeconds: parsed.OTP_COOLDOWN_SECONDS,
    otpMaxAttempts: parsed.OTP_MAX_ATTEMPTS,
    otpSalt: parsed.OTP_SALT ?? parsed.TOKEN_SEED,
    s3Endpoint: parsed.S3_ENDPOINT,
    s3AccessKey: parsed.S3_ACCESS_KEY,
    s3SecretKey: parsed.S3_SECRET_KEY,
    s3Bucket: parsed.S3_BUCKET,
    s3ForcePathStyle: parsed.S3_FORCE_PATH_STYLE === "true"
  };
}
