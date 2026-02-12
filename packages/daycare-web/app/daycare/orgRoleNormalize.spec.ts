import { describe, expect, it } from "vitest";
import { orgRoleNormalize } from "./orgRoleNormalize";

describe("orgRoleNormalize", () => {
  it("normalizes OWNER to owner", () => {
    expect(orgRoleNormalize("OWNER")).toBe("owner");
  });

  it("normalizes MEMBER to member", () => {
    expect(orgRoleNormalize("MEMBER")).toBe("member");
  });

  it("returns undefined for empty roles", () => {
    expect(orgRoleNormalize(undefined)).toBeUndefined();
    expect(orgRoleNormalize(null)).toBeUndefined();
    expect(orgRoleNormalize("")).toBeUndefined();
  });

  it("defaults unknown roles to member", () => {
    expect(orgRoleNormalize("ADMIN")).toBe("member");
  });
});
