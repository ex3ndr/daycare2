# Web: Authentication (Email OTP)

This spec defines the email OTP authentication flow for the Daycare web client, including server-side OTP infrastructure and client-side UI.

Depends on: `api.md` (§5.1 Auth endpoints), `db.md` (Account, Session models), `web-router.md` (route structure)

## 1. Flow Overview

```
                     ┌─────────────┐
                     │  /login     │
                     │  Email form │
                     └──────┬──────┘
                            │ POST /api/auth/email/request-otp
                            ▼
                     ┌──────────────┐
                     │ /login/verify│
                     │ 6-digit OTP  │
                     └──────┬───────┘
                            │ POST /api/auth/email/verify-otp
                            ▼
                     ┌──────────────┐
                     │ authStore    │
                     │ saves token  │
                     └──────┬───────┘
                            │ navigate to / (root redirect)
                            ▼
                ┌───────────────────────┐
                │ RootRedirect resolves │
                │ next destination      │
                └───────────────────────┘
```

## 2. Server: OTP Infrastructure

### 2.1 New Prisma Model

Add to `schema.prisma`:

```prisma
model OtpChallenge {
  id        String   @id
  email     String
  codeHash  String
  expiresAt DateTime
  attempts  Int      @default(0)
  consumed  Boolean  @default(false)
  createdAt DateTime @default(now())

  @@index([email, consumed, expiresAt])
}
```

Fields:
- `codeHash`: SHA-256 hash of the 6-digit code. Never store plaintext.
- `expiresAt`: 10 minutes from creation.
- `attempts`: Incremented on each verify attempt. Max 5 before auto-consumed.
- `consumed`: Set to `true` on successful verify or after max attempts.

### 2.2 OTP Code Generation

File: `sources/apps/auth/otpCodeGenerate.ts`

```ts
function otpCodeGenerate(): { code: string; hash: string }
```

- Generate a 6-digit numeric string (crypto.randomInt, zero-padded).
- Hash with `crypto.createHash('sha256').update(code).digest('hex')`.
- Return both the plaintext code (for email) and the hash (for storage).

### 2.3 Email Transport

File: `sources/modules/email/emailServiceCreate.ts`

```ts
interface EmailService {
  send(params: { to: string; subject: string; text: string }): Promise<void>;
}

function emailServiceCreate(config: Config): EmailService
```

Two transport implementations:

| Transport | File | When |
|---|---|---|
| Console | `consoleEmailTransport.ts` | `NODE_ENV !== 'production'` — logs code to stdout |
| Resend | `resendEmailTransport.ts` | Production — calls Resend API with `RESEND_API_KEY` |

The OTP email:
```
Subject: Your Daycare login code
Body:
Your verification code is: 847291

This code expires in 10 minutes.
If you didn't request this, ignore this email.
```

### 2.4 `POST /api/auth/email/request-otp`

File: `sources/apps/auth/otpRequest.ts`

Per `api.md` §5.1. Implementation details:

1. Validate email with zod (`z.string().email()`).
2. Rate limit: count unconsumed, unexpired challenges for this email. If >= 3 → return 429 with `retryAfterMs`.
3. Generate OTP code + hash.
4. Create `OtpChallenge` row with 10-minute expiry.
5. Send email via `emailService.send()`.
6. Return `{ sent: true, retryAfterMs: 60000 }`.

The `retryAfterMs` tells the client when it can request another code.

### 2.5 `POST /api/auth/email/verify-otp`

File: `sources/apps/auth/otpVerify.ts`

Per `api.md` §5.1. Implementation details:

1. Validate `{ email, otp }` with zod. `otp` must be exactly 6 digits.
2. Find the most recent unconsumed, unexpired `OtpChallenge` for this email.
3. If none found → 401 `UNAUTHORIZED` "No active code for this email".
4. Increment `attempts`.
5. If `attempts > 5` → mark consumed, return 401 "Too many attempts. Request a new code."
6. Hash the submitted OTP. Compare against `codeHash`.
7. If mismatch → 401 "Invalid code" with `{ attemptsRemaining: 5 - attempts }`.
8. If match → mark consumed.
9. Find or create `Account` by email.
10. Create `Session` (token via `tokenServiceCreate`).
11. Determine onboarding state:
    - `needsProfile`: account has no User records with a `firstName`.
    - `needsOrganization`: account has no User records at all.
12. Return `{ session, account, onboarding: { needsProfile, needsOrganization } }`.

### 2.6 Dev Shortcut

Keep existing `POST /api/auth/login` but gate it:

```ts
if (process.env.NODE_ENV === 'production') {
  return reply.status(404).send({ ok: false, error: { code: 'NOT_FOUND' } });
}
```

### 2.7 OTP Cleanup

Expired/consumed challenges should be cleaned periodically. Add a cron-style cleanup (runs every hour) that deletes `OtpChallenge` rows where `expiresAt < now() - 24h`. This can live in the existing file cleanup service or a dedicated `otpCleanup.ts`.

## 3. Client: Auth State Management

### 3.1 `authStore.ts`

File: `app/daycare/auth/authStore.ts`

A framework-agnostic store for the session token. Not a React hook — just a plain object so the API client and guards can read it synchronously.

```ts
interface AuthStore {
  getToken(): string | null;
  getAccount(): Account | null;
  setSession(token: string, account: Account): void;
  clear(): void;
  subscribe(listener: () => void): () => void;
}

function authStoreCreate(): AuthStore
```

Storage keys:
- `daycare:session:token` — the bearer token string.
- `daycare:session:account` — JSON-serialized Account object.

The `subscribe` method enables `useSyncExternalStore` integration for reactive reads inside React components.

### 3.2 `authContext.tsx`

File: `app/daycare/auth/authContext.tsx`

React context that wraps `authStore` for component use:

```ts
type AuthContextValue = {
  token: string | null;
  account: Account | null;
  isAuthenticated: boolean;
  login(token: string, account: Account): void;
  logout(): void;
};
```

`login()` writes to `authStore` and navigates to `/`.
`logout()` calls `POST /api/auth/logout`, clears `authStore`, navigates to `/login`.

The `AuthProvider` wraps the entire app (inside `RouterProvider` is fine since it doesn't depend on routing).

### 3.3 API Client Integration

The existing `apiRequest.ts` reads the token from `authStore.getToken()` for the `Authorization` header. On 401 responses, it should call `authStore.clear()` and trigger a redirect to `/login` (via a global event or by returning a sentinel that guards catch).

## 4. Client: Login Page

File: `app/pages/auth/LoginPage.tsx`

### 4.1 Layout

Centered vertically and horizontally. Max-width card (~400px). Clean background.

```
┌─────────────────────────────────┐
│                                 │
│        [Daycare wordmark]       │
│                                 │
│   Sign in to Daycare            │
│                                 │
│   Email address                 │
│   ┌───────────────────────┐     │
│   │ you@example.com       │     │
│   └───────────────────────┘     │
│                                 │
│   ┌───────────────────────┐     │
│   │  Continue with Email   │     │
│   └───────────────────────┘     │
│                                 │
│   By continuing, you agree to   │
│   Daycare's Terms of Service.   │
│                                 │
└─────────────────────────────────┘
```

### 4.2 Behavior

1. Email input with `type="email"`, `autoFocus`, `autoComplete="email"`.
2. Validate on submit: non-empty, valid email format (client-side check).
3. Disable button + show spinner during request.
4. Call `POST /api/auth/email/request-otp` with `{ email }`.
5. On success → `navigate("/login/verify", { state: { email }, replace: true })`.
6. On 429 → inline error: "Too many requests. Try again in X seconds."
7. On network error → inline error: "Unable to reach server. Check your connection."

### 4.3 States

| State | UI |
|---|---|
| Idle | Email input + button |
| Submitting | Input disabled, button shows spinner |
| Rate limited | Red inline error below button |
| Network error | Red inline error below button |

## 5. Client: OTP Verify Page

File: `app/pages/auth/OtpVerifyPage.tsx`

### 5.1 Layout

```
┌─────────────────────────────────┐
│                                 │
│        [Daycare wordmark]       │
│                                 │
│   Check your email              │
│   We sent a 6-digit code to    │
│   you@example.com               │
│                                 │
│   ┌─┐ ┌─┐ ┌─┐  ┌─┐ ┌─┐ ┌─┐   │
│   │ │ │ │ │ │  │ │ │ │ │ │     │
│   └─┘ └─┘ └─┘  └─┘ └─┘ └─┘    │
│                                 │
│   ┌───────────────────────┐     │
│   │      Verify Code       │     │
│   └───────────────────────┘     │
│                                 │
│   Didn't receive a code?        │
│   Resend (available in 42s)     │
│                                 │
│   ← Use a different email       │
│                                 │
└─────────────────────────────────┘
```

### 5.2 Entry Conditions

The page reads `email` from `location.state`. If `email` is missing (user navigated directly to `/login/verify` without going through `/login`), redirect to `/login`.

### 5.3 OTP Input Component

Build a dedicated `OtpInput` component (6 individual `<input>` elements):

- Each input: `type="text"`, `inputMode="numeric"`, `pattern="[0-9]"`, `maxLength={1}`.
- **Auto-advance**: On input, focus moves to the next field.
- **Backspace**: On empty field backspace, focus moves to previous field.
- **Paste support**: Intercept `onPaste` on any field. Extract digits from clipboard text. Fill all 6 fields. Focus last filled field.
- **Auto-submit**: When all 6 digits are filled (either by typing or pasting), automatically trigger verification. No need to click the button.
- Visual gap between digits 3 and 4 (like credit card number grouping) for readability.

### 5.4 Verification Behavior

1. Collect 6 digits into a string.
2. Call `POST /api/auth/email/verify-otp` with `{ email, otp }`.
3. On success:
   - `authStore.setSession(response.session.token, response.account)`.
   - If `response.onboarding.needsProfile` → navigate to `/welcome/profile`.
   - Else if `response.onboarding.needsOrganization` → navigate to `/welcome/org`.
   - Else → navigate to `searchParams.get("redirect") || "/"`.
4. On 401 (wrong code):
   - Shake animation on the inputs (CSS `@keyframes shake`).
   - Show "Invalid code. X attempts remaining." below the inputs in red.
   - Clear all inputs, focus the first one.
5. On 401 (expired/consumed):
   - Show "This code has expired." with a prominent "Resend code" button.

### 5.5 Resend Behavior

- "Resend code" link below the inputs.
- After requesting a code, start a 60-second countdown. Show "Resend (available in Xs)".
- When countdown expires, show "Resend code" as a clickable link.
- On click → call `POST /api/auth/email/request-otp` again with the same email.
- On success → reset countdown to 60s, clear inputs, show "New code sent." toast/inline message.

### 5.6 "Use a different email" Link

Navigates back to `/login`. Preserves any `?redirect=` param.

### 5.7 States

| State | UI |
|---|---|
| Waiting for input | 6 empty digit fields, button disabled |
| All digits entered | Button enabled, auto-submit fires |
| Verifying | Inputs disabled, button shows spinner |
| Wrong code | Shake animation, error text, inputs cleared |
| Expired | Error text, prominent resend button |
| Resend cooldown | "Resend (available in Xs)" countdown |
| Success | Brief checkmark flash, then navigate |

## 6. Security Considerations

| Concern | Mitigation |
|---|---|
| Brute force OTP | Max 5 attempts per challenge. After 5, challenge is consumed. |
| OTP spray (many emails) | Rate limit at IP level (Fastify rate-limit plugin, future). Per-email limit of 3 active challenges. |
| Token theft | Tokens are hashed server-side (`Session.tokenHash`). Raw token only sent once in verify response. |
| Replay | Challenge marked `consumed` on successful verify. Can't reuse. |
| Enumeration | Both request and verify return generic errors. Don't confirm whether an email exists. |
| Plaintext code in DB | `codeHash` stores SHA-256 hash, not plaintext. |

## 7. Server File Structure

```
sources/apps/auth/
├── otpRequest.ts
├── otpRequest.spec.ts
├── otpVerify.ts
├── otpVerify.spec.ts
├── otpCodeGenerate.ts
├── otpCodeGenerate.spec.ts
├── otpCleanup.ts
├── otpCleanup.spec.ts
├── authLogin.ts                    # existing, gated to dev-only
├── authLogout.ts                   # existing
└── _routes.ts                      # register new OTP routes

sources/modules/email/
├── emailServiceCreate.ts
├── consoleEmailTransport.ts
└── resendEmailTransport.ts
```

## 8. Implementation Order

1. `OtpChallenge` Prisma model + migration.
2. `otpCodeGenerate.ts` + unit test.
3. `emailServiceCreate.ts` with console transport.
4. `otpRequest.ts` + integration test.
5. `otpVerify.ts` + integration test.
6. Gate `authLogin.ts` behind dev check.
7. `authStore.ts` + `authContext.tsx` on web.
8. `LoginPage.tsx`.
9. `OtpInput` component.
10. `OtpVerifyPage.tsx`.
11. Wire into router.
