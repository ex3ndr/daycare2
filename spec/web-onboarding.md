# Web: Profile Creation & Organization Onboarding

This spec defines the post-authentication onboarding flow: profile setup, organization selection, and organization creation.

Depends on: `api.md` (§5.2 org discovery, §5.4 profile), `db.md` (Account, User, Organization models), `web-router.md` (route structure), `web-auth.md` (auth flow)

## 1. Flow Overview

After successful OTP verification, the verify-otp response includes an `onboarding` object:

```ts
{
  onboarding: {
    needsProfile: boolean;    // no User record with firstName anywhere
    needsOrganization: boolean; // no User records at all
  }
}
```

The client routes the user based on these flags:

```
needsProfile=true        → /welcome/profile
needsOrganization=true   → /welcome/org
both false                → / (root redirect → workspace)
```

For returning users who already have a profile and orgs, onboarding is skipped entirely.

## 2. Welcome Layout

File: `app/pages/welcome/WelcomeLayout.tsx`

Shared frame for all three onboarding pages. Consistent with the auth pages (login, verify) for visual continuity.

```
┌──────────────────────────────────────────┐
│                                          │
│  [Daycare wordmark]        [step N of M] │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │                                    │  │
│  │        Page content here           │  │
│  │                                    │  │
│  └────────────────────────────────────┘  │
│                                          │
└──────────────────────────────────────────┘
```

- Centered card, max-width ~480px.
- Step indicator in top-right: "Step 1 of 2", "Step 2 of 2" (profile, then org).
- If the user already has a profile and just needs an org, show "Step 1 of 1".

## 3. Profile Setup Page

File: `app/pages/welcome/ProfileSetupPage.tsx`

### 3.1 Purpose

Collect the minimum information to create the user's identity. This happens once per account, before any org is joined.

### 3.2 Layout

```
┌────────────────────────────────────┐
│                                    │
│  What should we call you?          │
│                                    │
│  ┌──────────┐                      │
│  │  Avatar   │  Upload photo       │
│  │    JD     │  or keep initials   │
│  └──────────┘                      │
│                                    │
│  First name *                      │
│  ┌────────────────────────────┐    │
│  │ Jane                       │    │
│  └────────────────────────────┘    │
│                                    │
│  Last name                         │
│  ┌────────────────────────────┐    │
│  │ Doe                        │    │
│  └────────────────────────────┘    │
│                                    │
│  Username *                        │
│  ┌────────────────────────────┐    │
│  │ janedoe                    │    │
│  └────────────────────────────┘    │
│  This is how others @mention you   │
│                                    │
│  Timezone                          │
│  ┌────────────────────────────┐    │
│  │ America/New_York        ▼  │    │
│  └────────────────────────────┘    │
│  Auto-detected from your browser   │
│                                    │
│  ┌────────────────────────────┐    │
│  │         Continue            │    │
│  └────────────────────────────┘    │
│                                    │
└────────────────────────────────────┘
```

### 3.3 Field Behavior

**Avatar**
- Initially shows initials derived from first name (and last name if provided).
- Click opens a file picker (accept `image/png, image/jpeg, image/webp`).
- After selection, show a circular crop preview.
- Upload via the existing file upload flow (`POST /api/org/:orgid/files/upload-init` + upload). But we don't have an org yet at this point — so avatar upload is deferred. Show the upload UI, but store the file locally. Upload happens when the user joins/creates an org.
- **Simplification for v1**: Skip avatar upload during onboarding. Show initials. Let the user upload an avatar later from their profile settings within a workspace.

**First name** (required)
- `autoFocus` on mount.
- Trimmed on blur. Min 1 char, max 80 chars.
- As the user types, auto-generate a username suggestion (see below).

**Last name** (optional)
- Max 80 chars.
- Also contributes to username auto-generation.

**Username** (required)
- Auto-generated from first name + last name:
  - `"Jane" + "Doe"` → `"janedoe"`
  - `"Jane"` → `"jane"`
  - Strip non-alphanumeric, lowercase, truncate to 32 chars.
- User can manually edit. Once manually edited, stop auto-generating.
- Validation: `[a-z0-9_]{3,32}`, per `api.md` §7.
- Uniqueness check: debounced (300ms after typing stops). Call a validation endpoint or attempt on submit. Show inline feedback: checkmark (available) or red X (taken).
- Helper text: "This is how others @mention you"

**Timezone**
- Pre-filled from `Intl.DateTimeFormat().resolvedOptions().timeZone`.
- Dropdown/select with all IANA timezone strings.
- Grouped by region (America, Europe, Asia, etc.) for easier scanning.
- Searchable — user can type to filter.
- Default is almost always correct, so most users won't touch this.

### 3.4 Submission

The profile data needs to be persisted. Since the user doesn't have an org yet, we need an account-level profile endpoint.

**Server change needed**: The existing API spec (`api.md`) defines profile endpoints under `/api/org/:orgid/profile/*`, which require org context. For the onboarding flow, we need a way to store profile data before the user has an org.

**Approach**: Use a temporary account-level store. Two options:

**Option A** — New endpoint `PATCH /api/me/profile`:
```
PATCH /api/me/profile
{ firstName, lastName, username, timezone }
```
Stores on the Account model (add optional fields). When the user joins/creates an org, these become the defaults for the User record.

**Option B** — Client-side only:
Store profile data in `localStorage`. Pass it along when calling `POST /api/org/create` or `POST /api/org/:orgid/join` (both already accept `firstName`, `username`).

**Recommendation**: Option B is simpler and avoids Account model changes. The profile data lives in `localStorage` until an org is created/joined. The data flows:

```
ProfileSetupPage → localStorage("daycare:pendingProfile")
                           ↓
OrgCreatePage → POST /api/org/create { name, slug }
                           ↓ returns { organization }
             → POST /api/org/:id/profile/create { firstName, lastName, username, timezone }
```

### 3.5 Client State

```ts
type PendingProfile = {
  firstName: string;
  lastName: string | null;
  username: string;
  timezone: string;
};

// Stored in localStorage("daycare:pendingProfile") as JSON
```

### 3.6 Navigation

On "Continue":
1. Validate all fields client-side.
2. If username uniqueness can't be checked pre-org, defer to org join/create time.
3. Store `PendingProfile` in localStorage.
4. Navigate to `/welcome/org`.

### 3.7 States

| State | UI |
|---|---|
| Idle | Form with pre-filled timezone, auto-focused first name |
| Username generating | Username field updates as first/last name changes |
| Username manual | Username field stops auto-updating |
| Submitting | Button disabled + spinner |
| Validation error | Red border on invalid fields, error text below each |

## 4. Organization Selection Page

File: `app/pages/welcome/OrgSelectPage.tsx`

### 4.1 Purpose

Show organizations the user can join or has already joined. Offer to create a new one.

### 4.2 Layout

```
┌────────────────────────────────────┐
│                                    │
│  Choose a workspace                │
│                                    │
│  ┌────────────────────────────┐    │
│  │  🏢 Acme Corp              │    │
│  │     acme · 12 members      │    │
│  │                    [Open →] │    │
│  └────────────────────────────┘    │
│                                    │
│  ┌────────────────────────────┐    │
│  │  🏢 Side Project            │    │
│  │     sideproj · 3 members   │    │
│  │                    [Open →] │    │
│  └────────────────────────────┘    │
│                                    │
│  ─────────── or ───────────        │
│                                    │
│  ┌────────────────────────────┐    │
│  │  + Create a new workspace   │    │
│  └────────────────────────────┘    │
│                                    │
└────────────────────────────────────┘
```

### 4.3 Behavior

1. On mount, fetch `GET /api/org/available`.
2. Render each org as a card with:
   - Org avatar (or colored initials fallback).
   - Org name.
   - Org slug.
   - Member count (from API response or a separate call).
   - "Open" button if already a member, "Join" button if joinable but not yet a member.
3. If the user has no orgs and no joinable orgs → show only the "Create" option with friendlier copy: "Create your first workspace".
4. If the user has exactly one org → auto-redirect to it (skip the selection page). The `WelcomeGuard` handles this (see `web-router.md` §4.2).

### 4.4 Opening an Org

When the user clicks "Open" on an org they already belong to:
1. Check if they have a User/profile in that org (they should if they're a member).
2. Navigate to `/${org.slug}`.

### 4.5 Joining an Org

When the user clicks "Join" on a joinable org:
1. Read `PendingProfile` from localStorage (set during profile setup).
2. Call `POST /api/org/:orgid/join` with `{ firstName, lastName, username }` from pending profile.
3. If username conflict in this org → show inline error, let user pick a different username.
4. On success → clear `PendingProfile` from localStorage, navigate to `/${org.slug}`.

### 4.6 "Create a new workspace" Button

Navigates to `/welcome/org/new`.

### 4.7 Empty State

If the API returns zero organizations (no memberships, nothing joinable):

```
┌────────────────────────────────────┐
│                                    │
│  Welcome to Daycare!               │
│                                    │
│  Create a workspace to get         │
│  started with your team.           │
│                                    │
│  ┌────────────────────────────┐    │
│  │ Create your first workspace │    │
│  └────────────────────────────┘    │
│                                    │
└────────────────────────────────────┘
```

### 4.8 States

| State | UI |
|---|---|
| Loading | Skeleton cards (2-3 placeholder rows) |
| Empty | Friendly message + create button |
| Has orgs | Org cards + create button |
| Joining | Clicked org shows spinner |
| Join error | Inline error on the org card |

## 5. Organization Create Page

File: `app/pages/welcome/OrgCreatePage.tsx`

### 5.1 Purpose

Create a new workspace (organization). The user becomes the owner.

### 5.2 Layout

```
┌────────────────────────────────────┐
│                                    │
│  Create a new workspace            │
│                                    │
│  Workspace name *                  │
│  ┌────────────────────────────┐    │
│  │ Acme Corp                  │    │
│  └────────────────────────────┘    │
│  This could be your company or     │
│  team name.                        │
│                                    │
│  Workspace URL *                   │
│  daycare.app /                     │
│  ┌────────────────────────────┐    │
│  │ acme-corp                  │    │
│  └────────────────────────────┘    │
│                                    │
│  ┌────────────────────────────┐    │
│  │      Create Workspace       │    │
│  └────────────────────────────┘    │
│                                    │
│  ← Back to workspace selection     │
│                                    │
└────────────────────────────────────┘
```

### 5.3 Field Behavior

**Workspace name** (required)
- `autoFocus` on mount.
- Max 100 chars.
- As the user types, auto-generate slug (see below).
- Helper text: "This could be your company or team name."

**Workspace URL / slug** (required)
- Auto-generated from name:
  - `"Acme Corp"` → `"acme-corp"`
  - Lowercase, replace spaces/special chars with hyphens, strip leading/trailing hyphens, collapse consecutive hyphens.
- User can manually edit. Once manually edited, stop auto-generating.
- Validation: lowercase kebab-case `[a-z0-9-]{3,48}`, per `api.md` §7.
- Uniqueness check: debounced (300ms). Show inline feedback (checkmark / red X).
- Prefix display: "daycare.app /" shown as static text before the input, so the user sees the full URL.

### 5.4 Submission

On "Create Workspace":

1. Validate fields client-side.
2. Read `PendingProfile` from localStorage.
3. Call `POST /api/org/create` with `{ name, slug }`.
4. On success, the response includes `{ organization, user, membership }`.
   - If the response doesn't auto-create the profile, call `POST /api/org/:id/profile/create` with `{ firstName, lastName, username, timezone }` from `PendingProfile`.
5. Clear `PendingProfile` from localStorage.
6. Navigate to `/${organization.slug}`.

If `POST /api/org/create` already handles profile creation (it accepts `firstName`, `username` in the request body per the existing implementation), then step 4 is a single call:

```
POST /api/org/create
{
  name: "Acme Corp",
  slug: "acme-corp",
  firstName: "Jane",       // from PendingProfile
  lastName: "Doe",         // from PendingProfile
  username: "janedoe",     // from PendingProfile
}
```

### 5.5 Error Handling

| Error | UI |
|---|---|
| Slug taken (409 CONFLICT) | Red text below slug field: "This URL is already taken." |
| Username taken in new org | This shouldn't happen (new org has no other users). But if it does: show error, let user edit username. |
| Network error | Inline error: "Unable to create workspace. Try again." |
| Validation error | Red borders on invalid fields |

### 5.6 Back Navigation

"← Back to workspace selection" navigates to `/welcome/org`.

### 5.7 States

| State | UI |
|---|---|
| Idle | Form with auto-focused name field |
| Slug generating | Slug updates as name changes |
| Slug manual | Slug stops auto-updating |
| Slug checking | Small spinner next to slug input |
| Slug available | Green checkmark next to slug input |
| Slug taken | Red X + error text |
| Submitting | Button disabled + spinner |
| Error | Inline error messages |

## 6. Data Flow Summary

```
LoginPage
  └→ POST /api/auth/email/request-otp
OtpVerifyPage
  └→ POST /api/auth/email/verify-otp
       └→ authStore.setSession(token, account)
       └→ response.onboarding.needsProfile? → /welcome/profile

ProfileSetupPage
  └→ validate fields
  └→ localStorage.set("daycare:pendingProfile", { firstName, lastName, username, timezone })
  └→ navigate to /welcome/org

OrgSelectPage
  └→ GET /api/org/available
  └→ User clicks "Open" on existing org
       └→ navigate to /${org.slug}
  └→ User clicks "Join" on joinable org
       └→ POST /api/org/:id/join { ...pendingProfile }
       └→ localStorage.remove("daycare:pendingProfile")
       └→ navigate to /${org.slug}
  └→ User clicks "Create new workspace"
       └→ navigate to /welcome/org/new

OrgCreatePage
  └→ POST /api/org/create { name, slug, ...pendingProfile }
  └→ localStorage.remove("daycare:pendingProfile")
  └→ navigate to /${org.slug}
```

## 7. Edge Cases

| Scenario | Handling |
|---|---|
| User refreshes `/welcome/profile` | Form is empty (no persistence). They fill it again. Acceptable for v1. |
| User refreshes `/welcome/org` | `PendingProfile` is in localStorage, survives refresh. Org list re-fetched. |
| User navigates directly to `/welcome/org/new` without profile | `WelcomeGuard` checks if profile data exists (in localStorage). If not → redirect to `/welcome/profile`. |
| User has multiple browser tabs | `authStore` uses localStorage events for cross-tab sync. Login in one tab logs in all tabs. |
| User goes back from `/welcome/org` to `/welcome/profile` | Profile form is re-populated from `PendingProfile` in localStorage. |
| Returning user hits `/welcome/*` | `WelcomeGuard` detects they already have profile + orgs → redirects to `/`. |

## 8. Implementation Order

1. `WelcomeLayout.tsx` — shared card frame with step indicator.
2. `ProfileSetupPage.tsx` — form with auto-generated username, timezone picker, localStorage persistence.
3. `OrgSelectPage.tsx` — fetch orgs, render list, handle join + open.
4. `OrgCreatePage.tsx` — form with auto-generated slug, create call.
5. `WelcomeGuard.tsx` — redirect logic based on profile/org state.
6. Wire all into router.
7. End-to-end test: login → profile → create org → land in workspace.
