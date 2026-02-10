import { z } from "zod";

const configSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().min(1).default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3005),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  TOKEN_SERVICE: z.string().min(2).default("daycare"),
  TOKEN_SEED: z.string().min(16),
  ALLOW_OPEN_ORG_JOIN: z.string().optional()
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
    allowOpenOrgJoin
  };
}
