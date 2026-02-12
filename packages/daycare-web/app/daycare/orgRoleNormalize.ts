import type { OrgRole } from "./types";

export function orgRoleNormalize(role: string | null | undefined): OrgRole | undefined {
  if (!role) {
    return undefined;
  }

  return role.toLowerCase() === "owner" ? "owner" : "member";
}
