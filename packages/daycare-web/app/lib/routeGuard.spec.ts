import { describe, it, expect } from "vitest";
import {
  guardAuthenticated,
  guardWorkspace,
  guardLogin,
  guardIndex,
  type AuthState,
} from "./routeGuard";

describe("guardAuthenticated", () => {
  it("redirects to /login when no token", () => {
    const auth: AuthState = { token: null, orgSlug: null };
    expect(guardAuthenticated(auth)).toEqual({ redirect: "/login" });
  });

  it("allows access when token is present", () => {
    const auth: AuthState = { token: "tok_123", orgSlug: null };
    expect(guardAuthenticated(auth)).toEqual({ redirect: null });
  });

  it("allows access when token and orgSlug are present", () => {
    const auth: AuthState = { token: "tok_123", orgSlug: "acme" };
    expect(guardAuthenticated(auth)).toEqual({ redirect: null });
  });
});

describe("guardWorkspace", () => {
  it("redirects to /login when no token", () => {
    const auth: AuthState = { token: null, orgSlug: null };
    expect(guardWorkspace(auth)).toEqual({ redirect: "/login" });
  });

  it("redirects to /orgs when token but no orgSlug", () => {
    const auth: AuthState = { token: "tok_123", orgSlug: null };
    expect(guardWorkspace(auth)).toEqual({ redirect: "/orgs" });
  });

  it("allows access when both token and orgSlug are present", () => {
    const auth: AuthState = { token: "tok_123", orgSlug: "acme" };
    expect(guardWorkspace(auth)).toEqual({ redirect: null });
  });
});

describe("guardLogin", () => {
  it("allows access when no token", () => {
    const auth: AuthState = { token: null, orgSlug: null };
    expect(guardLogin(auth)).toEqual({ redirect: null });
  });

  it("redirects to /orgs when token but no orgSlug", () => {
    const auth: AuthState = { token: "tok_123", orgSlug: null };
    expect(guardLogin(auth)).toEqual({ redirect: "/orgs" });
  });

  it("redirects to org workspace when fully authenticated", () => {
    const auth: AuthState = { token: "tok_123", orgSlug: "acme" };
    expect(guardLogin(auth)).toEqual({ redirect: "/acme" });
  });
});

describe("guardIndex", () => {
  it("redirects to /login when no token", () => {
    const auth: AuthState = { token: null, orgSlug: null };
    expect(guardIndex(auth)).toEqual({ redirect: "/login" });
  });

  it("redirects to /orgs when token but no orgSlug", () => {
    const auth: AuthState = { token: "tok_123", orgSlug: null };
    expect(guardIndex(auth)).toEqual({ redirect: "/orgs" });
  });

  it("redirects to org workspace when fully authenticated", () => {
    const auth: AuthState = { token: "tok_123", orgSlug: "acme" };
    expect(guardIndex(auth)).toEqual({ redirect: "/acme" });
  });
});
