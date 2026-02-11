// Pure function: given auth state and current path, returns redirect path or null.
// Used by TanStack Router beforeLoad guards.

export type AuthState = {
  token: string | null;
  orgSlug: string | null;
};

export type RouteGuardResult = {
  redirect: string | null;
};

// For routes that require authentication (workspace, orgs)
export function guardAuthenticated(auth: AuthState): RouteGuardResult {
  if (!auth.token) {
    return { redirect: "/login" };
  }
  return { redirect: null };
}

// For routes that require both auth and an active org (workspace routes)
export function guardWorkspace(auth: AuthState): RouteGuardResult {
  if (!auth.token) {
    return { redirect: "/login" };
  }
  if (!auth.orgSlug) {
    return { redirect: "/orgs" };
  }
  return { redirect: null };
}

// For the login route - redirect away if already authenticated
export function guardLogin(auth: AuthState): RouteGuardResult {
  if (auth.token && auth.orgSlug) {
    return { redirect: `/${auth.orgSlug}` };
  }
  if (auth.token) {
    return { redirect: "/orgs" };
  }
  return { redirect: null };
}

// For the index route - decide where to go
export function guardIndex(auth: AuthState): RouteGuardResult {
  if (!auth.token) {
    return { redirect: "/login" };
  }
  if (!auth.orgSlug) {
    return { redirect: "/orgs" };
  }
  return { redirect: `/${auth.orgSlug}` };
}
