# Web: React Router & Route Structure

This spec defines the URL scheme, route tree, guard layers, and navigation model for the Daycare web SPA.

Depends on: `api.md` (endpoint contracts), `db.md` (data model)

## 1. Dependency

Add `react-router-dom` (v6.4+) to `daycare-web`. Use `createBrowserRouter` with the data-router API — no `<BrowserRouter>` wrapper.

## 2. Route Tree

```
/                                  → RootRedirect (see §3)
│
├── /login                         → LoginPage            (public)
├── /login/verify                  → OtpVerifyPage         (public)
│
├── /welcome                       → WelcomeLayout         (auth required)
│   ├── /welcome/profile           → ProfileSetupPage
│   ├── /welcome/org               → OrgSelectPage
│   └── /welcome/org/new           → OrgCreatePage
│
└── /:orgSlug                      → WorkspaceLayout       (auth + org membership)
    ├── (index)                    → redirect to first joined channel
    ├── /c/:channelSlug            → ChannelView
    │   └── /t/:threadId           → ThreadPanel (nested outlet, right panel)
    └── /dm/:conversationId        → DirectMessageView     (future placeholder)
        └── /t/:threadId           → ThreadPanel
```

Notes:
- `/welcome` instead of `/onboarding` — shorter, friendlier.
- `/:orgSlug` uses the human-readable slug, not the cuid2 id.
- `/c/` prefix avoids collision with org-level routes if we add `/settings`, `/members`, etc. later.
- Thread routes are **nested** under the channel/dm route so the channel view stays mounted and the thread opens as a side panel — exactly like Slack.

## 3. Root Redirect (`/`)

`RootRedirect` is a tiny component (no layout). Logic:

1. No token in storage → `/login`
2. Token exists, fetch `GET /api/me` to verify session:
   - 401 → clear token, `/login`
   - Account needs profile → `/welcome/profile`
   - Account has no orgs → `/welcome/org`
   - Account has orgs → `/${lastUsedOrgSlug || firstOrg.slug}`
3. "Last used org" is stored in `localStorage` key `daycare:lastOrg`.

## 4. Guard Layout Routes

Guards are **React Router layout routes** that render `<Outlet />` when access is granted and `<Navigate />` when it is not. They also provide data to children via outlet context.

### 4.1 `AuthGuard`

Wraps: `/welcome/*` and `/:orgSlug/*`

Behavior:
1. Read token from `authStore` (localStorage-backed, reactive via `useSyncExternalStore`).
2. If no token → `<Navigate to="/login" replace />`.
3. Fetch `GET /api/me` (cached for the session). Expose `{ account, session }` via outlet context.
4. If fetch returns 401 → clear token, redirect to `/login`.
5. While loading → render a full-screen spinner (not a blank page).

```ts
type AuthGuardContext = {
  account: Account;
  session: Session;
};
```

### 4.2 `WelcomeGuard`

Wraps: `/welcome/*`

Inherits `AuthGuardContext` from parent.

Behavior:
1. If account already has a complete profile AND has orgs → `<Navigate to="/" replace />` (root redirect will land them in a workspace).
2. Otherwise → render `<Outlet />` with the welcome layout (centered card, logo).

This guard prevents users who are already set up from seeing the welcome flow if they navigate to `/welcome` directly.

### 4.3 `WorkspaceGuard`

Wraps: `/:orgSlug/*`

Inherits `AuthGuardContext` from parent.

Behavior:
1. Read `orgSlug` from `useParams()`.
2. Fetch `GET /api/org/available` and find the org matching `slug`.
3. If no match or not a member → `<Navigate to="/welcome/org" replace />`.
4. Resolve the user's profile within the org (`GET /api/org/:orgid/profile`).
5. If profile doesn't exist (no User record in this org) → redirect to `/welcome/profile` with the org context.
6. Store `orgSlug` in `localStorage` as `daycare:lastOrg`.
7. Expose org + user + profile data via outlet context.

```ts
type WorkspaceGuardContext = {
  organization: Organization;
  user: User;
  channels: Channel[];
};
```

## 5. File Layout

```
app/
├── router.ts                          # createBrowserRouter definition
├── main.tsx                           # <RouterProvider /> + global providers
├── guards/
│   ├── AuthGuard.tsx
│   ├── WelcomeGuard.tsx
│   └── WorkspaceGuard.tsx
├── pages/
│   ├── RootRedirect.tsx
│   ├── auth/
│   │   ├── LoginPage.tsx
│   │   └── OtpVerifyPage.tsx
│   ├── welcome/
│   │   ├── WelcomeLayout.tsx          # shared card/logo frame
│   │   ├── ProfileSetupPage.tsx
│   │   ├── OrgSelectPage.tsx
│   │   └── OrgCreatePage.tsx
│   └── workspace/
│       ├── WorkspaceLayout.tsx        # rail + sidebar + main + thread grid
│       ├── ChannelView.tsx
│       ├── ThreadPanel.tsx
│       └── WorkspaceRedirect.tsx      # index route → first channel
├── components/                        # UI kit (renamed from compontnes/)
└── daycare/
    ├── api/
    ├── sync/
    ├── auth/
    │   ├── authStore.ts
    │   └── authContext.tsx
    └── types.ts
```

## 6. Router Definition Sketch

```ts
// app/router.ts
import { createBrowserRouter, Navigate } from "react-router-dom";

export const router = createBrowserRouter([
  // Public routes
  { path: "/login", element: <LoginPage /> },
  { path: "/login/verify", element: <OtpVerifyPage /> },

  // Root redirect
  { path: "/", element: <RootRedirect /> },

  // Auth-required routes
  {
    element: <AuthGuard />,
    children: [
      // Welcome / onboarding
      {
        path: "/welcome",
        element: <WelcomeGuard />,
        children: [
          { index: true, element: <Navigate to="profile" replace /> },
          { path: "profile", element: <ProfileSetupPage /> },
          { path: "org", element: <OrgSelectPage /> },
          { path: "org/new", element: <OrgCreatePage /> },
        ],
      },

      // Workspace
      {
        path: "/:orgSlug",
        element: <WorkspaceGuard />,
        children: [
          { index: true, element: <WorkspaceRedirect /> },
          {
            path: "c/:channelSlug",
            element: <ChannelView />,
            children: [
              { path: "t/:threadId", element: <ThreadPanel /> },
            ],
          },
          {
            path: "dm/:conversationId",
            element: <DirectMessageView />,
            children: [
              { path: "t/:threadId", element: <ThreadPanel /> },
            ],
          },
        ],
      },
    ],
  },
]);
```

## 7. Navigation Patterns

| Action | Navigation |
|---|---|
| Login success | `navigate("/", { replace: true })` — root redirect routes to workspace or onboarding |
| Logout | `authStore.clearToken()` then `navigate("/login", { replace: true })` |
| Profile saved | `navigate("/welcome/org", { replace: true })` |
| Org selected | `navigate("/${org.slug}", { replace: true })` |
| Org created | `navigate("/${newOrg.slug}", { replace: true })` |
| Channel click (sidebar) | `navigate("/${orgSlug}/c/${channelSlug}")` — no replace, pushes history |
| Thread open | `navigate("/${orgSlug}/c/${channelSlug}/t/${threadId}")` — nested, channel stays mounted |
| Thread close | `navigate("/${orgSlug}/c/${channelSlug}")` — back to channel-only view |
| Org switch | `navigate("/${newOrgSlug}")` — workspace guard tears down old context, builds new |
| Browser back | Natural browser history. Channel/thread navigations are history entries. |

## 8. Deep Link Support

Every URL is a valid entry point. The guard cascade resolves from top to bottom:

1. `AuthGuard` verifies the session.
2. `WorkspaceGuard` resolves the org and user profile.
3. `ChannelView` loads messages for the channel.
4. `ThreadPanel` loads thread replies if the thread route is active.

If any guard fails, the user lands at the appropriate earlier step (login, profile, org selection) with the original URL preserved in a `?redirect=` param so they can resume after completing the required step.

## 9. Redirect Preservation

When a guard redirects, it should preserve the intended destination:

```ts
// In AuthGuard, when redirecting to login:
<Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />

// In LoginPage, after successful auth:
const redirect = searchParams.get("redirect") || "/";
navigate(redirect, { replace: true });
```

This ensures that pasting `https://daycare.app/acme/c/general/t/abc123` when logged out will return the user to that exact channel + thread after authentication.
