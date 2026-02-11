# Web: Boot Sequence

This spec defines the async boot function that runs before the React app mounts. It handles font loading, session restoration, and initial data prefetch so the app renders into a known-good state rather than flickering through loading/redirect cascades.

Depends on: `web-router.md` (route guards), `web-auth.md` (authStore, session)

## 1. Problem

Today the app mounts synchronously:

```ts
createRoot(document.getElementById("root")!).render(<StrictMode><DaycareApp /></StrictMode>);
```

Three fonts are loaded via a blocking CSS `@import url("https://fonts.googleapis.com/css2?...")` in `styles.css`. This means:

1. **FOUT/FOIT**: The browser either shows invisible text (FOIT) or system fonts that snap to custom fonts mid-render (FOUT) depending on the browser.
2. **No session validation before mount**: The app mounts, _then_ discovers the token is expired, _then_ redirects. The user sees a flash of workspace UI before being kicked to login.
3. **No centralized pre-render gate**: Each guard independently fetches data. There's no shared "the app is ready" signal.

## 2. Solution: `appBoot()`

A single async function that runs between `DOMContentLoaded` and `createRoot().render()`. While it runs, the user sees a minimal splash screen rendered in plain HTML (no React). When it resolves, React mounts with all critical data pre-loaded.

```
DOMContentLoaded
  → show splash (static HTML, already in index.html)
  → appBoot()
      → load fonts
      → restore session from storage
      → validate session (GET /api/me)
      → determine initial route
  → createRoot().render(<App bootResult={result} />)
  → hide splash
```

## 3. Splash Screen

The splash is **not a React component** — it's static HTML in `index.html` that displays immediately while JS bundles load and boot runs. React replaces it on mount.

### 3.1 index.html Changes

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Daycare</title>
    <style>
      /* Inline critical styles for the splash — no external CSS dependency */
      .boot-splash {
        position: fixed;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: #f4f1ec;
        color: #1f1d1a;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        transition: opacity 200ms ease;
      }
      .boot-splash[data-hidden] {
        opacity: 0;
        pointer-events: none;
      }
      .boot-splash-mark {
        width: 48px;
        height: 48px;
        border-radius: 14px;
        background: rgba(208, 106, 45, 0.12);
        border: 1px solid rgba(208, 106, 45, 0.4);
        display: grid;
        place-items: center;
        font-weight: 700;
        font-size: 1.1rem;
        color: #a74b1b;
        margin-bottom: 16px;
      }
      .boot-splash-spinner {
        width: 20px;
        height: 20px;
        border: 2px solid rgba(208, 106, 45, 0.2);
        border-top-color: #d06a2d;
        border-radius: 50%;
        animation: spin 600ms linear infinite;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      .boot-splash-error {
        display: none;
        margin-top: 16px;
        padding: 12px 16px;
        border-radius: 10px;
        background: rgba(196, 71, 71, 0.08);
        border: 1px solid rgba(196, 71, 71, 0.25);
        color: #7a2a2a;
        font-size: 0.88rem;
        max-width: 340px;
        text-align: center;
      }
    </style>
  </head>
  <body>
    <div id="boot-splash" class="boot-splash">
      <div class="boot-splash-mark">DC</div>
      <div id="boot-spinner" class="boot-splash-spinner"></div>
      <div id="boot-error" class="boot-splash-error"></div>
    </div>
    <div id="root"></div>
    <script type="module" src="/app/main.tsx"></script>
  </body>
</html>
```

The splash is visible immediately (no JS required). The `#root` div is empty until React mounts. After mount, the splash fades out and is removed.

## 4. Font Loading

### 4.1 Current State

```css
@import url("https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;600;700&family=IBM+Plex+Mono:wght@400;600&family=Karla:wght@400;500;600;700&display=swap");
```

This is a render-blocking CSS import. The browser must download the Google Fonts CSS, parse it, then download the font files before rendering text.

### 4.2 New Approach

Remove the `@import` from `styles.css`. Load fonts programmatically during boot using the [CSS Font Loading API](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Font_Loading_API) (`document.fonts`).

File: `app/boot/fontsLoad.ts`

```ts
const FONT_FACES = [
  { family: "Karla", weight: "400", src: "..." },
  { family: "Karla", weight: "500", src: "..." },
  { family: "Karla", weight: "600", src: "..." },
  { family: "Karla", weight: "700", src: "..." },
  { family: "IBM Plex Mono", weight: "400", src: "..." },
  { family: "IBM Plex Mono", weight: "600", src: "..." },
  { family: "Bricolage Grotesque", weight: "400", src: "..." },
  { family: "Bricolage Grotesque", weight: "600", src: "..." },
  { family: "Bricolage Grotesque", weight: "700", src: "..." },
];

async function fontsLoad(): Promise<void> {
  const faces = FONT_FACES.map((f) => {
    const face = new FontFace(f.family, f.src, { weight: f.weight, display: "swap" });
    document.fonts.add(face);
    return face.load();
  });

  await Promise.allSettled(faces);
}
```

**Font source strategy**: Two options:

| Option | Pros | Cons |
|---|---|---|
| Google Fonts URLs | No hosting cost, CDN-cached globally | External dependency, privacy concerns, CORS |
| Self-hosted in `/public/fonts/` | No external deps, works offline, faster (same origin) | Slightly larger initial bundle |

**Recommendation**: Self-host the fonts. Copy the `.woff2` files into `public/fonts/`. Reference them with relative URLs. This removes the Google Fonts dependency entirely and eliminates the render-blocking `@import`.

### 4.3 Timeout

Font loading should not block boot indefinitely. Use `Promise.race` with a timeout:

```ts
await Promise.race([
  fontsLoad(),
  delay(3000),  // 3 second max wait
]);
```

If fonts haven't loaded after 3 seconds, boot proceeds anyway. The CSS `font-display: swap` fallback ensures text is visible with system fonts, and custom fonts swap in when they finish loading.

### 4.4 styles.css Change

Remove the `@import` line. The `@font-face` declarations are handled programmatically. The CSS custom properties (`--font`, `--mono`, `--display`) remain unchanged — they still reference the font family names.

## 5. Session Restoration

### 5.1 Flow

```ts
async function sessionRestore(authStore: AuthStore): Promise<BootSessionResult> {
  const token = authStore.getToken();

  if (!token) {
    return { status: "no-session" };
  }

  try {
    const response = await apiRequest("GET", "/api/me", { token });

    if (!response.ok) {
      authStore.clear();
      return { status: "expired" };
    }

    const { account, session } = response.data;
    authStore.setSession(token, account);

    return { status: "valid", account, session };
  } catch {
    // Network error — token might be valid but we can't verify.
    // Keep the token, let guards retry when online.
    return { status: "offline" };
  }
}
```

### 5.2 Result Type

```ts
type BootSessionResult =
  | { status: "no-session" }                               // no stored token
  | { status: "expired" }                                  // token rejected by server
  | { status: "valid"; account: Account; session: Session } // token confirmed
  | { status: "offline" };                                 // network error, token kept
```

### 5.3 Behavior by Status

| Status | Boot action | Initial route |
|---|---|---|
| `no-session` | No-op | `/login` (AuthGuard will redirect) |
| `expired` | Clear token from storage | `/login` |
| `valid` | Populate authStore, prefetch org data | `/{lastOrg}` or `/welcome/*` |
| `offline` | Keep token, set offline flag | Attempt to render workspace; show offline banner |

## 6. Data Prefetch

When the session is valid, boot can prefetch data that every guard/page will need anyway. This eliminates the waterfall of `AuthGuard → fetch /me → WorkspaceGuard → fetch /org/available → ...`.

```ts
async function dataPrefetch(token: string, account: Account): Promise<BootPrefetchResult> {
  const orgs = await apiRequest("GET", "/api/org/available", { token });

  if (!orgs.ok) {
    return { orgs: [], needsOnboarding: true };
  }

  const lastOrgSlug = localStorage.getItem("daycare:lastOrg");
  const matchedOrg = orgs.data.items.find((o) => o.organization.slug === lastOrgSlug);
  const firstOrg = orgs.data.items[0] ?? null;
  const targetOrg = matchedOrg ?? firstOrg;

  return {
    orgs: orgs.data.items,
    targetOrg: targetOrg?.organization ?? null,
    targetUser: targetOrg?.user ?? null,
    needsOnboarding: orgs.data.items.length === 0,
  };
}
```

The prefetch result is passed into the React app as initial context, so guards can read it synchronously on first render rather than triggering their own fetches.

## 7. `appBoot()` Function

File: `app/boot/appBoot.ts`

```ts
type BootResult = {
  session: BootSessionResult;
  prefetch: BootPrefetchResult | null;
  fontsReady: boolean;
};

async function appBoot(): Promise<BootResult> {
  const authStore = authStoreCreate();

  // Run font loading and session restoration in parallel.
  const [fontsReady, session] = await Promise.all([
    Promise.race([fontsLoad().then(() => true), delay(3000).then(() => false)]),
    sessionRestore(authStore),
  ]);

  // Prefetch only if session is valid.
  let prefetch: BootPrefetchResult | null = null;
  if (session.status === "valid") {
    prefetch = await dataPrefetch(session.session.token, session.account);
  }

  return { session, prefetch, fontsReady };
}
```

Key design: fonts and session validation run **in parallel** since they're independent. Data prefetch runs **after** session validation since it requires a valid token.

## 8. Entry Point Changes

File: `app/main.tsx`

```ts
import { appBoot } from "./boot/appBoot";

async function main() {
  const splash = document.getElementById("boot-splash");
  const errorEl = document.getElementById("boot-error");
  const spinnerEl = document.getElementById("boot-spinner");

  try {
    const bootResult = await appBoot();

    // Mount React
    const root = createRoot(document.getElementById("root")!);
    root.render(
      <StrictMode>
        <BootContext.Provider value={bootResult}>
          <RouterProvider router={router} />
        </BootContext.Provider>
      </StrictMode>
    );

    // Fade out splash
    splash?.setAttribute("data-hidden", "");
    setTimeout(() => splash?.remove(), 250);
  } catch (error) {
    // Fatal boot error — show in splash, don't mount React
    if (spinnerEl) spinnerEl.style.display = "none";
    if (errorEl) {
      errorEl.style.display = "block";
      errorEl.textContent = "Something went wrong. Refresh to try again.";
    }
    console.error("[boot] fatal:", error);
  }
}

main();
```

Notable: the top-level call is `main()` (an async function), not a synchronous `createRoot().render()`. The splash screen handles the gap.

## 9. Boot Context

File: `app/boot/bootContext.ts`

```ts
type BootContextValue = {
  session: BootSessionResult;
  prefetch: BootPrefetchResult | null;
  fontsReady: boolean;
};

const BootContext = createContext<BootContextValue | null>(null);

function bootContextUse(): BootContextValue {
  const ctx = useContext(BootContext);
  if (!ctx) throw new Error("bootContextUse() called outside BootContext.Provider");
  return ctx;
}
```

Guards read from this context to avoid re-fetching data that boot already loaded:

```ts
// In AuthGuard:
const boot = bootContextUse();
if (boot.session.status === "valid") {
  // Skip the /api/me fetch — we already have the data.
  return <Outlet context={{ account: boot.session.account, session: boot.session.session }} />;
}
```

## 10. File Structure

```
app/
├── boot/
│   ├── appBoot.ts            # main boot orchestrator
│   ├── fontsLoad.ts          # Font Face API loading
│   ├── sessionRestore.ts     # token check + /api/me validation
│   ├── dataPrefetch.ts       # org list + target org resolution
│   └── bootContext.ts        # React context for boot result
├── main.tsx                  # entry point (async main → boot → render)
└── ...
```

Plus:
```
public/
└── fonts/
    ├── karla-400.woff2
    ├── karla-500.woff2
    ├── karla-600.woff2
    ├── karla-700.woff2
    ├── ibm-plex-mono-400.woff2
    ├── ibm-plex-mono-600.woff2
    ├── bricolage-grotesque-400.woff2
    ├── bricolage-grotesque-600.woff2
    └── bricolage-grotesque-700.woff2
```

## 11. Timing Budget

Target: boot completes in under **800ms** on a fast connection, under **2s** on 3G.

| Step | Expected time (fast) | Expected time (3G) |
|---|---|---|
| JS bundle parse + eval | ~100ms | ~300ms |
| Font load (self-hosted, parallel) | ~80ms | ~400ms |
| `GET /api/me` (session check) | ~50ms | ~200ms |
| `GET /api/org/available` (prefetch) | ~50ms | ~200ms |
| **Total (fonts ∥ session, then prefetch)** | **~200ms** | **~700ms** |

The 3-second font timeout is a safety net, not the expected path. Self-hosted `.woff2` files served from the same origin with gzip should load in well under a second.

## 12. Offline / Slow Network

If the network is unreachable during boot:

1. Font loading falls back to system fonts after 3s timeout (CSS custom properties still reference the families, but `font-display: swap` means system fonts show immediately).
2. Session restore returns `{ status: "offline" }`.
3. React mounts normally. The auth guard sees a stored token but unverified session.
4. The workspace layout renders with a **"Reconnecting..."** banner. The sync engine's existing reconnection logic handles recovery.
5. When the network comes back, the first API call succeeds, and the banner clears.

This means the app is usable (reads from cached state if any) even when boot can't reach the server — it degrades gracefully rather than blocking on a spinner forever.

## 13. Error Handling

| Failure | Behavior |
|---|---|
| Font load fails (some/all) | Boot proceeds. System fonts used. No user-visible error. |
| `GET /api/me` returns 401 | Token cleared. React mounts. AuthGuard redirects to `/login`. |
| `GET /api/me` returns 5xx | Treat as offline. Keep token. Show workspace with reconnecting banner. |
| `GET /api/me` network error | Treat as offline (same as above). |
| Prefetch (`/org/available`) fails | `prefetch` is `null`. Guards will fetch on their own — slower but functional. |
| JS runtime error in boot | Caught by `main()` try/catch. Splash shows error. React never mounts. User can refresh. |

## 14. Implementation Order

1. Self-host fonts: download `.woff2` files → `public/fonts/`, remove `@import` from `styles.css`.
2. `fontsLoad.ts` — FontFace API loader.
3. `sessionRestore.ts` — token check + validation.
4. `dataPrefetch.ts` — org list resolution.
5. `appBoot.ts` — orchestrate parallel loading.
6. `bootContext.ts` — React context for boot result.
7. Update `index.html` — add splash screen HTML + inline styles.
8. Rewrite `main.tsx` — async `main()` with boot → render → splash-hide.
9. Update guards to read from `bootContext` before fetching.
