import { createHash } from "node:crypto";

export function authOtpCodeHash(code: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${code}`).digest("hex");
}
