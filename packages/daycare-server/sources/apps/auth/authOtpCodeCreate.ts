import { randomInt } from "node:crypto";

export function authOtpCodeCreate(): string {
  const value = randomInt(0, 1_000_000);
  return value.toString().padStart(6, "0");
}
