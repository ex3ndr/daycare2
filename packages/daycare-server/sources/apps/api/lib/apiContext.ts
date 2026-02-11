import type { PrismaClient, Session, User } from "@prisma/client";
import type Redis from "ioredis";
import type { TokenService } from "@/modules/auth/tokenServiceCreate.js";
import type { EmailService } from "@/modules/email/emailServiceCreate.js";
import type { UpdatesService } from "@/modules/updates/updatesServiceCreate.js";

export type AuthContext = {
  session: Session;
  user: User;
};

export type ApiContext = {
  db: PrismaClient;
  redis: Redis;
  tokens: TokenService;
  email: EmailService;
  updates: UpdatesService;
  nodeEnv: "development" | "test" | "production";
  allowOpenOrgJoin: boolean;
  otp: {
    ttlSeconds: number;
    cooldownSeconds: number;
    maxAttempts: number;
    salt: string;
  };
};
