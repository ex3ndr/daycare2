# Web V1 Rebuild

## Overview
Complete rebuild of the Daycare web frontend on a modern stack: shadcn/ui + Tailwind, TanStack Router, @slopus/sync + Zustand. Every mutation is optimistic. The plan starts by deleting all existing UI code and building up from a clean slate, keeping only reusable infrastructure (API client, types, SSE helper).

**What gets deleted:**
- `app/compontnes/` — 13 custom CSS components (typo in dir name)
- `app/daycare/ui/daycareAppUse.ts` — monolithic 785-line state hook
- `app/daycare/sync/syncEngineCreate.ts` — old sync engine (replaced by @slopus/sync bridge)
- `app/main.tsx` — old single-component app entry
- `app/styles.css` — 992-line custom stylesheet (rebuilt as Tailwind + CSS variables)

**What survives:**
- `app/daycare/api/apiClientCreate.ts` — typed API client (~30 methods)
- `app/daycare/api/apiRequest.ts` — HTTP request helper
- `app/daycare/api/sseSubscribe.ts` — SSE stream parser
- `app/daycare/types.ts` — shared TypeScript types
- Config files: `vite.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.cjs`

**What this plan delivers:**
- shadcn/ui component library with Daycare warm aesthetic
- TanStack Router with deep linking to orgs, channels, threads, DMs
- @slopus/sync as primary state container with optimistic mutations
- Zustand for UI-only state (modals, composer drafts, sidebar collapse)
- Session persistence (token in localStorage)
- All existing features rebuilt + new features (DMs, file upload, search, message edit/delete, emoji picker, infinite scroll)

## Architecture

### State Layer (following happy-list pattern)
```
┌────────────────────────────────────────────────────────────┐
│  SyncEngine (@slopus/sync)                                 │
│  ┌───────────┐ ┌──────────┐ ┌────────────────┐             │
│  │ channel   │ │ message  │ │ member         │  type()     │
│  └───────────┘ └──────────┘ └────────────────┘  collections│
│  ┌───────────┐ ┌──────────┐                                │
│  │ readState │ │ typing   │                                │
│  └───────────┘ └──────────┘                                │
│  ┌──────────────────────────────────┐                      │
│  │ context (object singleton)       │  userId, orgId,      │
│  │                                  │  seqno (localField)  │
│  └──────────────────────────────────┘                      │
│  mutations: messageSend, channelCreate, ...                │
│  engine.mutate() → optimistic via Immer draft              │
│  engine.rebase() → merge server state, replay pending      │
│  engine.commit() → confirm mutation, remove from pending   │
│  engine.persist() → serialize to localStorage              │
└────────────────────────────────────────────────────────────┘
          ↕ wrapped by
┌────────────────────────────────────────────────────────────┐
│  Zustand StorageStore (wraps engine for React reactivity)  │
│  objects: engine.state          ← reactive snapshot        │
│  mutate(name, input)            ← engine.mutate + set()    │
│  updateObjects()                ← engine.state → set()     │
│  rebaseLocal(snapshot)          ← localField updates       │
└────────────────────────────────────────────────────────────┘
          ↕ owned by
┌────────────────────────────────────────────────────────────┐
│  AppController (orchestrates everything)                   │
│  engine: SyncEngine                                        │
│  storage: StorageStore (Zustand)                           │
│  api: ApiClient                                            │
│  sse: SSE client                                           │
│  sequencer: UpdateSequencer (batch + hole detection)       │
│                                                            │
│  static create(client, token) → factory                    │
│  startSSE() → connect to update stream                     │
│  syncChannels() → fetch + rebase channels                  │
│  applyServerMutation(mutation) → REST + rebase + commit    │
└────────────────────────────────────────────────────────────┘
          ↕ provided via
┌────────────────────────────────────────────────────────────┐
│  React layer                                               │
│  AppContext.Provider value={controller}                     │
│  useApp()             → AppController                      │
│  useStorage(selector) → reactive state from StorageStore   │
│  Separate uiStore     → modals, drafts, sidebar (Zustand)  │
└────────────────────────────────────────────────────────────┘
```

### Transport Layer
```
┌───────────────────────────────────────────────────┐
│  SSE + UpdateSequencer                            │
│                                                    │
│  SSE stream ← server pushes UpdateEnvelope        │
│  sequencer.push(update) ← batch + hole detection  │
│    • 100ms debounce for batching                   │
│    • 5s timeout for missing seqno (hole)           │
│    • on hole timeout → session restart (re-fetch)  │
│  diff endpoint ← catch-up after reconnect         │
│                                                    │
│  On SSE events (batched):                          │
│    1. Map event type → engine.rebase() partial     │
│    2. Engine replays pending mutations on new base  │
│    3. storage.updateObjects() → React re-renders   │
│                                                    │
│  On mutation dispatch:                             │
│    1. storage.mutate(name, input)                   │
│       → engine.mutate() optimistic                  │
│       → Zustand set() → React re-renders instantly  │
│    2. Invalidate sync → process pending mutations   │
│    3. applyServerMutation(pending):                 │
│       → REST call to server                         │
│       → engine.rebase(serverSnapshot)               │
│       → engine.commit(mutationId)                   │
│       → storage.updateObjects()                     │
└───────────────────────────────────────────────────┘
```

### Route Structure (TanStack Router)
```
/                          → redirect to /login or /orgs
/login                     → auth screen
/orgs                      → org selection
/:orgSlug                  → workspace (auto-select first channel)
/:orgSlug/c/:channelId     → channel view
/:orgSlug/c/:channelId/t/:threadId → channel + thread panel
/:orgSlug/dm/:dmId         → direct message
/:orgSlug/dm/:dmId/t/:threadId → DM + thread panel
/:orgSlug/search?q=...     → search results
```

## Context (from discovery)
- **Codebase:** `packages/daycare-web/app/` — 13 components, 1 main hook, 1 sync engine, 1 API client, types
- **Styling:** Custom CSS (992 lines), Tailwind configured but dormant, warm design tokens
- **State:** Single `daycareAppUse` hook with ~20 useState calls, no external store
- **API:** Fully typed client with ~30 methods, SSE subscription helper
- **Tests:** Zero — test script is a no-op stub
- **Dependencies:** React 18, Vite 5, Tailwind 3, TypeScript 5, no router/state lib

## Development Approach
- **Testing approach**: Regular (code first, then tests). Vitest for pure functions. **agent-browser for all visual/UI verification.**
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: every task MUST include new/updated tests** for pure functions and sync logic
- **CRITICAL: all tests must pass before starting next task**
- **CRITICAL: every task that produces visible UI MUST be verified via agent-browser** before moving on
- **CRITICAL: update this plan file when scope changes during implementation**
- Each milestone produces a buildable, testable state

## Testing Strategy

### Vitest (pure logic only)
- Sync schema, mutations, state derivations, event mappers, utility functions
- Zustand store actions
- Derived selectors
- Session store read/write

### agent-browser (primary UI verification)
**agent-browser is the main way we verify the app works.** After every task that touches UI, use agent-browser to:
1. Navigate to `http://localhost:7332` (Vite dev server)
2. Walk through the relevant user flow visually
3. Take screenshots to confirm layout, styling, and interactive behavior
4. Verify optimistic updates appear instantly and resolve correctly
5. Verify real-time SSE updates arrive (open two browser tabs if needed)

**Prerequisites before agent-browser testing:**
- Web running: `yarn web` (Vite on port 7332)
- Vite proxies `/api` to the public server at `https://daycare-api.korshakov.org/` — no local infra or server needed
- Use the integration OTP for login: email `integration-test@daycare.local`, code `424242`

**What to verify per milestone:**
| Milestone | agent-browser checks |
|---|---|
| 1. Tear Down | Page loads, shows placeholder |
| 2. Components | Temporary test page renders all shadcn components correctly |
| 3. State Layer | N/A (pure logic, Vitest only) |
| 4. Routing | URL navigation works, redirects fire, back/forward works |
| 5. Core Views | Full flow: login → org → channel → send message → thread → logout |
| 6. Features | Each feature: edit/delete, reactions, DMs, file upload, scroll, search |
| 7. Polish | Keyboard shortcuts, error states, loading skeletons, reconnection |

No React component unit tests — all UI correctness is verified visually via agent-browser.

## Progress Tracking
- Mark completed items with `[x]` immediately when done
- Add newly discovered tasks with ➕ prefix
- Document issues/blockers with ⚠️ prefix
- Update plan if implementation deviates from original scope

---

## Implementation Steps

---

### Milestone 1: Tear Down + Foundation

Start clean. Delete all old UI code, install the new stack, set up tooling.

#### Task 1: Delete old UI code

Remove everything that will be rebuilt. Keep only reusable infra.

- [x] Delete `app/compontnes/` directory entirely (13 custom components with typo in name)
- [x] Delete `app/daycare/ui/daycareAppUse.ts` (monolithic state hook)
- [x] Delete `app/daycare/sync/syncEngineCreate.ts` (old sync engine)
- [x] Delete `app/main.tsx` (old single-component entry point)
- [x] Delete `app/styles.css` (custom stylesheet — will be rebuilt)
- [x] Verify what remains:
  - `app/daycare/api/apiClientCreate.ts` (keep)
  - `app/daycare/api/apiRequest.ts` (keep)
  - `app/daycare/api/sseSubscribe.ts` (keep)
  - `app/daycare/types.ts` (keep)
  - Config files (keep)
- [x] Create minimal `app/main.tsx` placeholder: renders `<div>Daycare</div>` so the app builds
- [x] Create minimal `app/styles.css` with only the CSS variable design tokens (`:root` block with `--bg`, `--accent`, `--rail`, `--sidebar`, fonts, radii) and Google Fonts import — no component classes
- [x] Verify `yarn typecheck` passes
- [x] **agent-browser**: open `http://localhost:7332`, verify placeholder renders, take screenshot

#### Task 2: Install dependencies

- [x] Install runtime deps: `zustand`, `@slopus/sync`, `@tanstack/react-router`, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`
- [x] Install shadcn deps: `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-popover`, `@radix-ui/react-tooltip`, `@radix-ui/react-scroll-area`, `@radix-ui/react-separator`, `@radix-ui/react-avatar`, `@radix-ui/react-slot`
- [x] Install test deps: `vitest`, `jsdom`
- [x] Verify `yarn typecheck` still passes after install

#### Task 3: Configure shadcn + Tailwind + Vitest

- [x] Create `app/lib/utils.ts` with `cn()` helper (clsx + tailwind-merge)
- [x] Update `tailwind.config.ts` — map Daycare warm palette into shadcn HSL variable format (`--background` ← beige, `--primary` ← orange, `--destructive` ← red, `--sidebar-*` ← dark tones)
- [x] Update `app/styles.css` — add shadcn CSS variables (`:root` and `.dark`) using the warm palette, keep Google Fonts import, keep body background gradient
- [x] Create `components.json` for shadcn CLI configuration
- [x] Create `packages/daycare-web/vitest.config.ts` with jsdom environment and path aliases
- [x] Update `package.json` test script: `"test": "vitest run"`
- [x] Write smoke test `app/lib/utils.spec.ts` testing `cn()` utility
- [x] Run tests — must pass

---

### Milestone 2: shadcn Component Library

Build all UI primitives before any views. Components are testable in isolation.

#### Task 4: Add shadcn base components

- [x] Create `app/components/ui/` directory
- [x] Add components:
  - `button.tsx` — variants: primary (warm orange gradient), secondary, ghost, destructive; sizes: sm, md, lg, icon
  - `input.tsx` — with focus ring in accent color
  - `textarea.tsx` — auto-resize option, focus ring
  - `dialog.tsx` — modal with header, body, footer, close button
  - `avatar.tsx` — initials fallback, sizes (xs, sm, md, lg), presence dot slot
  - `badge.tsx` — variants: neutral, accent/orange, success/green, danger/red; sizes: sm, md
  - `card.tsx` — with shadow and border
  - `scroll-area.tsx` — for message lists and sidebars
  - `separator.tsx` — horizontal/vertical
  - `tooltip.tsx` — for icon buttons
  - `dropdown-menu.tsx` — for message context menus
  - `popover.tsx` — for emoji picker, popovers
  - `command.tsx` — for search/command palette (Cmd+K)
- [x] Create temporary test page in `app/main.tsx` that renders all components with variant/size combinations
- [x] **agent-browser**: open test page, screenshot each component group, verify warm palette applied (orange primary, beige background, dark sidebar tones)
- [x] Verify `yarn typecheck` passes

---

### Milestone 3: State Layer (@slopus/sync + Zustand)

Build the complete data layer before any views. Fully testable with Vitest.

#### Task 5: Define sync schema

Define the @slopus/sync schema following the happy-list pattern (`defineSchema` + `type` + `object` + `field` + `localField` + `.withMutations()`).

- [x] Create `app/sync/schema.ts`:
  ```typescript
  import { defineSchema, field, localField, mutation, object, type, InferSchema } from "@slopus/sync";

  export const schema = defineSchema({
    // Collections (type = ID-indexed, like happy-list's list/task/user)
    channel: type({
      fields: {
        organizationId: field<string>(),
        name: field<string>(),
        topic: field<string | null>(),
        visibility: field<'public' | 'private'>(),
        createdAt: field<number>(),
        updatedAt: field<number>(),
        // Local-only fields (never synced to server)
        isJoined: localField<boolean>(false),
      }
    }),
    message: type({
      fields: {
        chatId: field<string>(),
        senderUserId: field<string>(),
        threadId: field<string | null>(),
        text: field<string>(),
        createdAt: field<number>(),
        editedAt: field<number | null>(),
        deletedAt: field<number | null>(),
        threadReplyCount: field<number>(),
        threadLastReplyAt: field<number | null>(),
        sender: field<{ id: string; kind: string; username: string; firstName: string; lastName: string | null; avatarUrl: string | null }>(),
        attachments: field<Array<{ id: string; kind: string; url: string; mimeType: string | null; fileName: string | null; sizeBytes: number | null; sortOrder: number }>>(),
        reactions: field<Array<{ id: string; userId: string; shortcode: string; createdAt: number }>>(),
        // Local-only
        pending: localField<boolean>(false),
      }
    }),
    member: type({
      fields: {
        kind: field<'human' | 'ai'>(),
        username: field<string>(),
        firstName: field<string>(),
        lastName: field<string | null>(),
        avatarUrl: field<string | null>(),
      }
    }),
    readState: type({
      fields: {
        chatId: field<string>(),
        lastReadAt: field<number | null>(),
        unreadCount: field<number>(),
      }
    }),
    typing: type({
      fields: {
        userId: field<string>(),
        username: field<string>(),
        firstName: field<string>(),
        expiresAt: field<number>(),
      }
    }),

    // Singletons (object = single instance, like happy-list's context)
    context: object({
      fields: {
        userId: field<string>(),
        orgId: field<string>(),
        orgSlug: field<string>(),
        orgName: field<string>(),
        // Local-only
        seqno: localField<number>(0),
      }
    }),
  }).withMutations({
    messageSend: mutation((draft, input: { id: string; chatId: string; text: string; threadId?: string | null }) => {
      // Optimistic: add message with pending=true, sender from context
      draft.message[input.id] = {
        id: input.id,
        chatId: input.chatId,
        senderUserId: draft.context.userId,
        threadId: input.threadId ?? null,
        text: input.text,
        createdAt: Date.now(),
        editedAt: null,
        deletedAt: null,
        threadReplyCount: 0,
        threadLastReplyAt: null,
        sender: { id: draft.context.userId, kind: 'human', username: '', firstName: '', lastName: null, avatarUrl: null },
        attachments: [],
        reactions: [],
        pending: true,
      };
    }),
    messageEdit: mutation((draft, input: { id: string; text: string }) => { ... }),
    messageDelete: mutation((draft, input: { id: string }) => { ... }),
    reactionToggle: mutation((draft, input: { messageId: string; shortcode: string }) => { ... }),
    channelCreate: mutation((draft, input: { id: string; name: string; topic?: string | null; visibility?: 'public' | 'private' }) => { ... }),
    readMark: mutation((draft, input: { chatId: string }) => { ... }),
  });

  export type Schema = InferSchema<typeof schema>;
  ```
- [x] Write tests for each mutation (create engine → mutate → assert engine.state matches expected)
- [x] Run tests — must pass before next task

#### Task 6: Create StorageStore (Zustand wrapper for sync engine)

Following happy-list's `storage.ts` pattern — wrap sync engine in Zustand for React reactivity.

- [x] Create `app/sync/storageStoreCreate.ts`:
  ```typescript
  import { create } from 'zustand';
  import type { InferMutations, InferMutationInput, PartialLocalUpdate, SyncEngine } from '@slopus/sync';
  import { schema, Schema } from './schema';

  export type StorageStore = {
    objects: SyncEngine<Schema>['state'];
    updateObjects: () => void;
    mutate: <M extends InferMutations<typeof schema>>(
      name: M,
      input: InferMutationInput<typeof schema, M>
    ) => void;
    rebaseLocal: (snapshot: PartialLocalUpdate<Schema>) => void;
  };

  export const storageStoreCreate = (engine: SyncEngine<Schema>, onMutate?: () => void) =>
    create<StorageStore>((set) => ({
      objects: engine.state,
      updateObjects: () => set((s) => ({ ...s, objects: engine.state })),
      mutate: (name, input) => {
        engine.mutate(name, input);
        set((s) => ({ ...s, objects: engine.state }));
        onMutate?.();
      },
      rebaseLocal: (snapshot) => {
        engine.rebase(snapshot, { allowLocalFields: true, allowServerFields: false });
        set((s) => ({ ...s, objects: engine.state }));
      },
    }));
  ```
- [x] Write tests for storageStoreCreate (mutate updates objects, rebaseLocal updates local fields only)
- [x] Run tests — must pass before next task

#### Task 7: Create AppController (sync orchestration)

Following happy-list's `AppController` pattern — class that owns engine + store + SSE + mutation dispatch.

- [x] Create `app/sync/AppController.ts`:
  - `static async create(api, token)` factory:
    - Fetch profile via `api.meGet(token)`
    - Try restoring from `localStorage` via `syncEngine(schema, { from: 'restore', data })`, fall back to `syncEngine(schema, { from: 'new', objects: { context: { userId, orgId, ... } } })`
    - Create `StorageStore` via `storageStoreCreate(engine, onMutate)`
    - Start SSE stream, wire up sequencer
  - `startSSE()`:
    - Subscribe via `api.updatesStreamSubscribe()`
    - Feed updates to `UpdateSequencer.push()`
    - On batched updates: map event types → `engine.rebase()` → `storage.updateObjects()`
  - `processPendingMutations()` (called on `onMutate` callback):
    - Loop through `engine.pendingMutations`
    - Call `applyServerMutation(api, mutation)` → get server snapshot
    - `engine.rebase(snapshot)` → `engine.commit(mutation.id)` → `storage.updateObjects()`
  - `syncChannels()`, `syncMessages(channelId)` — fetch + rebase
  - `persist()` — `engine.persist()` → `localStorage.setItem('daycare:engine', data)`
  - `destroy()` — close SSE, cleanup
- [x] Create `app/sync/mutationApply.ts` — `applyServerMutation(api, mutation)` function:
  - Maps each mutation name to the correct REST API call (like happy-list's `applyServerMutation`)
  - Returns `{ snapshot }` with server-authoritative data for `engine.rebase()`
  - Example: `messageSend` → `api.messageSend()` → return `{ message: [serverMessage] }`
- [x] Create `app/sync/UpdateSequencer.ts` — batching + hole detection:
  - 100ms debounce for batching consecutive updates
  - 5s timeout for missing seqno (hole detection)
  - On hole timeout → trigger session restart (re-fetch all state)
  - Track `currentSeqno` via `engine.rebase({ context: { seqno } }, { allowLocalFields: true })`
- [x] Create `app/sync/eventMappers.ts` — pure functions mapping `UpdateEnvelope` payloads to `PartialServerUpdate` shapes for `engine.rebase()`
- [x] Write tests for `eventMappers` (each SSE event type → correct rebase shape)
- [x] Write tests for `applyServerMutation` (each mutation → correct API call + snapshot shape)
- [x] Write tests for `UpdateSequencer` (sequential delivery, hole detection, batch flush)
- [x] Run tests — must pass before next task

#### Task 8: Create Zustand UI store

Separate thin Zustand store for purely client-side UI state (not synced to server at all).

- [x] Create `app/stores/uiStore.ts`:
  - `sidebarCollapsed: boolean`
  - `composerDrafts: Record<channelId, string>` — per-channel draft text
  - `threadComposerDraft: string`
  - `activeModal: 'createOrg' | 'createChannel' | 'channelSettings' | 'userProfile' | null`
  - `searchOpen: boolean`
  - `searchQuery: string`
  - Actions: `sidebarToggle`, `composerDraftSet`, `modalOpen`, `modalClose`, `searchToggle`
- [x] Write tests for uiStore (set/get/clear for each field)
- [x] Run tests — must pass before next task

#### Task 9: Create React context and hooks

Following happy-list's `context.ts` pattern — AppContext + useApp + useStorage.

- [x] Create `app/sync/AppContext.ts`:
  ```typescript
  import * as React from 'react';
  import { AppController } from './AppController';
  import { StorageStore } from './storageStoreCreate';
  import type { ExtractState, StoreApi } from 'zustand';

  export const AppContext = React.createContext<AppController | null>(null);

  export function useApp() {
    const app = React.useContext(AppContext);
    if (!app) throw new Error('useApp must be used within AppContext');
    return app;
  }

  export function useStorage<U>(selector: (state: ExtractState<StoreApi<StorageStore>>) => U) {
    return useApp().storage(selector);
  }
  ```
- [x] Create derived selectors in `app/sync/selectors.ts`:
  - `channelsForCurrentOrg(state)` — channels filtered by context.orgId
  - `messagesForChannel(state, channelId)` — sorted by createdAt
  - `threadMessagesForRoot(state, threadId)` — thread replies sorted
  - `unreadCountForChannel(state, chatId)` — from readState collection
  - `typingUsersForChannel(state, chatId, selfUserId)` — filtered, exclude self, exclude expired
- [x] Usage in components:
  ```typescript
  // Read reactive state
  const channels = useStorage((s) => Object.values(s.objects.channel));
  const mutate = useStorage((s) => s.mutate);

  // Dispatch optimistic mutation
  mutate('messageSend', { id: cuid(), chatId, text });
  ```
- [x] Write tests for derived selectors (given mock state → expected output)
- [x] Run tests — must pass before next task

---

### Milestone 4: Routing + Session

#### Task 10: TanStack Router setup

- [x] Create route tree in `app/routes/`:
  - `__root.tsx` — root layout with SyncProvider, error boundary
  - `login.tsx` — `/login`
  - `orgs.tsx` — `/orgs`
  - `_workspace.tsx` — layout route (rail + sidebar chrome)
  - `_workspace.$orgSlug.tsx` — org workspace layout
  - `_workspace.$orgSlug.c.$channelId.tsx` — channel view
  - `_workspace.$orgSlug.c.$channelId.t.$threadId.tsx` — thread panel
  - `_workspace.$orgSlug.dm.$dmId.tsx` — DM view
  - `_workspace.$orgSlug.dm.$dmId.t.$threadId.tsx` — DM thread panel
  - `_workspace.$orgSlug.search.tsx` — search results
  - `_workspace.$orgSlug.index.tsx` — org index placeholder
  - `index.tsx` — `/` redirect
- [x] Create `app/router.ts` — router instance with route tree
- [x] Update `app/main.tsx` — render `<RouterProvider>` instead of placeholder
- [x] Implement route guards: redirect `/login` if no token, `/orgs` if no org
- [x] Write tests for route guard logic (pure function: auth state → redirect path)
- [x] Run tests — must pass before next task

#### Task 11: Session persistence

- [x] Create `app/lib/sessionStore.ts` — read/write `{ token, accountId }` to localStorage key `daycare:session`
- [x] Create `app/lib/sessionRestore.ts` — on load, read session, validate via `GET /api/me`, restore or clear
- [x] Wire into route guards: login stores token, logout clears token
- [x] Write tests for `sessionStore` (get/set/clear, handles corrupt data)
- [x] Write tests for `sessionRestore` logic (valid token, expired, missing)
- [x] Run tests — must pass before next task

---

### Milestone 5: Core Views

Build every screen. After this milestone the app is fully functional for core messaging.

#### Task 12: Auth screen (`/login`)

- [x] Build `app/routes/login.tsx` using shadcn Card, Input, Button, Badge
- [x] Login flow: email input → `POST /api/auth/login` → store token → redirect to `/orgs`
- [x] Loading state (Button disabled + spinner)
- [x] Error display (inline error message)
- [x] Daycare warm aesthetic (gradient background, grain overlay, centered card)
- [x] **agent-browser**: navigate to `/login`, enter integration test email, submit, verify redirect to `/orgs`, screenshot login card and loading state
- [x] Run tests — must pass before next task

#### Task 13: Organization picker (`/orgs`)

- [x] Build `app/routes/orgs.tsx` — list orgs from `GET /api/me`, click to enter workspace
- [x] "Create Organization" Dialog with form fields (name, slug, firstName, username)
- [x] On org click: load org → start sync engine → redirect to `/:orgSlug`
- [x] On create: create org → start sync → redirect
- [x] **agent-browser**: login → arrive at `/orgs` → screenshot org list → create new org → verify redirect to workspace → screenshot
- [x] Run tests — must pass before next task

#### Task 14: Workspace layout (`_workspace` route)

The workspace chrome: rail, sidebar, content area, thread panel.

- [x] Build `app/routes/_workspace.tsx` — CSS Grid layout (rail 76px, sidebar 280px, content 1fr, thread 320px)
- [x] Build `app/components/workspace/Rail.tsx` — org avatar, org switcher, logout (dark background)
- [x] Build `app/components/workspace/Sidebar.tsx` — org name, user info, channel list, DM section (dark background)
- [x] Channel list: ScrollArea, clickable rows with unread Badge, active highlight
- [x] "New Channel" button → Dialog
- [x] Routing: channel click → `/:orgSlug/c/:channelId`
- [x] **agent-browser**: verify 4-column layout (dark rail, dark sidebar, light chat, light thread), click channels and verify URL changes, screenshot full workspace, verify unread badges show on non-selected channels
- [x] Run tests — must pass before next task

#### Task 15: Channel view (messages + composer)

The main messaging view.

- [x] Build `app/routes/_workspace.$orgSlug.c.$channelId.tsx`:
  - Channel header (name, topic, sync status badge)
  - Message list in ScrollArea with auto-scroll to bottom
  - Typing indicator line
  - Composer: Textarea + Send Button, Enter to send, Shift+Enter newline
- [x] Build `app/components/messages/MessageRow.tsx` — avatar, author name + handle + timestamp, text, reaction badges, thread button
- [x] Build `app/components/messages/Composer.tsx` — connected to `messageSend` mutation
- [x] Optimistic send: message appears immediately with `pending` badge, resolves on commit
- [x] Typing signals: emit on keystroke (throttled 1.5s), show typing users from sync state
- [x] Read marking: mark read on channel select + on new messages while viewing
- [x] **agent-browser**: type a message → hit Enter → verify message appears instantly with "sending" badge → wait for badge to disappear (SSE confirm) → screenshot. Open second tab, send message there, verify it appears in first tab via SSE.
- [x] Run tests — must pass before next task

#### Task 16: Thread panel

- [x] Build `app/routes/_workspace.$orgSlug.c.$channelId.t.$threadId.tsx`:
  - Thread root message at top
  - Thread replies in ScrollArea
  - Thread composer
  - Close button → navigate back to channel
- [x] Thread opens via "Thread" button on message → thread URL
- [x] Replies use `messageSend` mutation with `threadId`
- [x] **agent-browser**: click "Thread" on a message → verify thread panel opens with root message at top and URL updates → type reply → verify it appears → click Close → verify panel closes and URL reverts → screenshot open and closed states
- [x] Run tests — must pass before next task

---

### Milestone 6: Feature Completion

#### Task 17: Message edit and delete UI

- [x] Add "Edit" / "Delete" to message context menu (DropdownMenu on hover)
- [x] Edit: inline edit mode — text becomes editable Textarea, save/cancel buttons
- [x] Edit uses `messageEdit` mutation (optimistic: text + editedAt update immediately)
- [x] Delete: confirmation Dialog, then `messageDelete` mutation (optimistic: set deletedAt)
- [x] Show "(edited)" indicator on edited messages
- [x] Show deleted messages as "[This message was deleted]" or hide
- [x] Only show edit/delete for own messages
- [x] **agent-browser**: hover a message → verify context menu appears → click Edit → verify inline textarea with old text → change text → save → verify "(edited)" label appears instantly (optimistic) → screenshot. Click Delete on another message → confirm dialog → verify message disappears → screenshot.
- [x] Run tests for edit/delete mutations — must pass before next task

#### Task 18: Emoji reactions

- [x] Build `app/components/messages/ReactionBar.tsx` — existing reactions as clickable Badges with count, highlighted if user reacted
- [x] Build `app/components/messages/EmojiPicker.tsx` — Popover with grid of common shortcodes (`:thumbsup:`, `:fire:`, `:heart:`, `:laugh:`, `:eyes:`, `:check:`, `:clap:`, `:rocket:`, `:thinking:`, `:100:`)
- [x] Click existing reaction → toggle (add/remove via `reactionToggle` mutation)
- [x] "+" button → EmojiPicker for new reaction
- [x] Optimistic: reaction appears/disappears immediately
- [x] **agent-browser**: click "+" on a message → verify emoji picker popover → click `:fire:` → verify reaction badge appears with count 1 and highlighted → click it again → verify it disappears → screenshot picker open and reaction states
- [x] Run tests for reaction toggle logic — must pass before next task

#### Task 19: Direct messages UI

Depends on backend DM API routes.

- [x] DM section in Sidebar: list DMs showing other user's avatar + name
- [x] "New Message" button → Dialog with member list
- [x] Build `app/routes/_workspace.$orgSlug.dm.$dmId.tsx` — same message view but DM header (user avatar + name)
- [x] DM creation → `POST /api/org/:orgid/directs` → navigate to DM route
- [x] Same message list and composer components
- [x] **agent-browser**: click "New Message" in sidebar → select a member → verify DM opens with user's name as header → send a message → verify it appears → check sidebar shows DM in list → screenshot
- [x] Run tests — must pass before next task

#### Task 20: File upload UI

Depends on backend S3 integration.

- [x] Build `app/components/messages/FileUpload.tsx` — drop zone + file picker in composer area
- [x] Upload flow: select file → `upload-init` → `upload` (base64) → include fileId in message
- [x] Progress indicator (pending → uploading → ready)
- [x] Attached files as chips below composer before sending
- [x] Build `app/components/messages/Attachment.tsx` — image preview, file icon + name for documents
- [x] Drag-and-drop support onto message area
- [x] **agent-browser**: click file picker → select an image → verify chip appears below composer with progress → send message → verify image preview renders in message → screenshot composer with attachment and sent message with preview
- [x] Run tests for upload state machine — must pass before next task

#### Task 21: Infinite scroll / message pagination

- [x] Scroll-to-top loads older messages via `before` cursor
- [x] "Jump to bottom" button when scrolled up + new messages arrive
- [x] Auto-scroll to bottom on new messages only if already at bottom
- [x] Merge paginated messages into sync engine state via rebase
- [x] Loading spinner at top while fetching
- [x] **agent-browser**: in a channel with many messages, scroll to top → verify spinner appears → verify older messages load → scroll to middle → send message from second tab → verify "jump to bottom" button appears → click it → verify scroll snaps to newest message → screenshot
- [x] Run tests — must pass before next task

#### Task 22: Search UI

Depends on backend full-text search.

- [x] Build `app/routes/_workspace.$orgSlug.search.tsx` — search results page
- [x] Cmd+K → Command palette, search messages + channels
- [x] Message results: text with highlight, channel, author, timestamp
- [x] Channel results: name + topic
- [x] Click message → navigate to channel at that message (`around` pagination)
- [x] Click channel → navigate to channel
- [x] **agent-browser**: press Cmd+K → verify command palette opens → type search term → verify results appear with highlights → click a message result → verify navigation to correct channel and message is visible → screenshot palette and result navigation
- [x] Run tests — must pass before next task

#### Task 23: User presence indicators

Depends on backend presence system.

- [x] Presence dot on Avatar (green = online, yellow = away, gray = offline)
- [x] Fetch presence for visible members
- [x] Heartbeat every 60 seconds
- [x] Listen for `user.presence` SSE events → update sync state
- [x] Show in: member list, DM sidebar, message avatars
- [x] **agent-browser**: login in two tabs with different users → verify green presence dots on both users' avatars → close one tab → wait 30s → verify dot turns gray on the remaining tab → screenshot both states
- [x] Run tests — must pass before next task

#### Task 24: Channel settings and member management

- [x] Build `app/components/workspace/ChannelSettings.tsx` — Dialog with tabs:
  - Overview: editable name, topic, visibility
  - Members: list with role badges, kick (owner), role change (owner)
- [x] Open via channel header settings icon
- [x] Archive/unarchive button (owner, depends on backend)
- [x] Notification preferences dropdown (ALL / MENTIONS_ONLY / MUTED)
- [x] **agent-browser**: click settings icon in channel header → verify dialog opens with Overview tab → edit channel name → save → verify header updates → switch to Members tab → verify member list with role badges → screenshot both tabs
- [x] Run tests — must pass before next task

---

### Milestone 7: Polish and Verification

#### Task 25: Keyboard shortcuts

- [x] `Enter` — send message
- [x] `Shift+Enter` — newline
- [x] `Cmd+K` / `Ctrl+K` — open search
- [x] `Escape` — close thread/modal/search
- [x] `Up Arrow` (empty composer) — edit last own message
- [x] `Cmd+/` — keyboard shortcut help overlay
- [x] **agent-browser**: press Cmd+K → verify search opens → press Escape → verify it closes → press Up in empty composer → verify edit mode on last message → press Cmd+/ → verify help overlay → screenshot each

#### Task 26: Error handling and loading states

- [x] Error boundary at route level (catch errors, show retry UI)
- [x] Loading skeletons for channel list, message list, thread panel
- [x] Toast notifications for send failed, connection lost, reconnected
- [x] SSE disconnect: "Reconnecting..." banner, auto-retry
- [x] 401 responses: clear session, redirect to login
- [x] **agent-browser**: stop the API server → verify "Reconnecting..." banner appears → restart server → verify banner disappears and messages reload → screenshot reconnection state. Navigate to a channel → verify loading skeletons show briefly before messages appear → screenshot skeleton state.

#### Task 27: Verify acceptance criteria

- [ ] Verify `app/compontnes/` directory no longer exists
- [ ] Verify no references to `daycareAppUse` or old `syncEngineCreate`
- [ ] Verify TanStack Router handles all routes: login, orgs, channels, threads, DMs, search
- [ ] Verify browser back/forward works
- [ ] Verify deep linking (paste channel URL → loads after auth)
- [ ] Verify @slopus/sync manages all server state with optimistic mutations
- [ ] Verify Zustand handles UI-only state
- [ ] Verify session persists across refresh
- [ ] Verify message send is optimistic
- [ ] Verify reaction toggle is optimistic
- [ ] Verify channel create is optimistic
- [ ] Verify read marking is optimistic
- [ ] Verify message edit/delete works
- [ ] Verify file upload works (if backend ready)
- [ ] Verify infinite scroll loads older messages
- [ ] Verify search works (if backend ready)
- [ ] Verify presence indicators (if backend ready)
- [ ] Verify typing indicators work
- [ ] Verify thread panel works
- [ ] Run full test suite — all pass
- [ ] Run `yarn typecheck` — no errors
- [ ] **agent-browser full smoke test**: complete end-to-end flow with screenshots at each step:
  1. Open `/login` → enter integration email → submit
  2. Arrive at `/orgs` → select or create org
  3. Land in workspace → verify layout (rail, sidebar, chat, thread panel)
  4. Click a channel → verify messages load
  5. Send a message → verify optimistic + SSE confirm
  6. Open thread → reply → close thread
  7. Add reaction → verify count → remove reaction
  8. Edit a message → verify "(edited)"
  9. Delete a message → verify removal
  10. Cmd+K → search → click result → verify navigation
  11. Open DM → send message
  12. Logout → verify redirect to `/login`

#### Task 28: [Final] Update documentation

- [ ] Update CLAUDE.md with new web architecture (shadcn, TanStack Router, @slopus/sync, Zustand)
- [ ] Update `packages/daycare-web/package.json` description
- [ ] Document route structure
- [ ] Update `app/daycare/types.ts` with any new types

## Technical Details

### @slopus/sync API Summary (from happy-list reference)

**Schema DSL:**
- `defineSchema({ ... }).withMutations({ ... })` — schema + mutations in one chain
- `type({ fields: { ... } })` — ID-indexed collection (like `channel`, `message`)
- `object({ fields: { ... } })` — singleton (like `context`)
- `field<T>()` — server-synced field
- `localField<T>(default)` — client-only field (cursors, pending flags, UI state)
- `mutation((draft, input: T) => { ... })` — Immer-style optimistic updater
- `InferSchema<typeof schema>` — infer full schema type
- `InferMutations<typeof schema>` — union of mutation names
- `InferMutationInput<typeof schema, M>` — input type for mutation M

**Engine lifecycle:**
```typescript
// Create new
const engine = syncEngine(schema, {
  from: 'new',
  objects: { context: { userId, orgId, orgSlug, orgName } }
});

// Restore from localStorage
const engine = syncEngine(schema, {
  from: 'restore',
  data: localStorage.getItem('daycare:engine')!
});

// Persist
localStorage.setItem('daycare:engine', engine.persist());
```

**Engine operations:**
- `engine.mutate(name, input)` — apply optimistic mutation (adds to `pendingMutations`)
- `engine.rebase(partial)` — merge server data, replay pending mutations on new base
- `engine.rebase(partial, { allowLocalFields: true, allowServerFields: false })` — update local fields only
- `engine.commit(mutationId)` — remove confirmed mutation from pending list
- `engine.state` — current computed state (server + pending)
- `engine.serverState` — server base state (before pending)
- `engine.pendingMutations` — array of `{ id, name, input, timestamp }`
- `engine.persist()` — serialize to string for localStorage

### Optimistic Mutation Flow (messageSend)

Following happy-list's pattern: `mutate → REST → rebase → commit`

```
1. User hits Enter
2. storage.mutate('messageSend', { id, chatId, text })
   → engine.mutate() creates pending mutation, applies Immer draft
   → message appears in engine.state with pending: true
   → Zustand set({ objects: engine.state }) triggers React re-render
   → onMutate() callback invalidates sync
3. processPendingMutations() picks up pending mutation
4. applyServerMutation(api, mutation):
   → api.messageSend(token, orgId, { channelId, text })
   → server returns real message with server ID, timestamps
   → returns { snapshot: { message: [serverMessage] } }
5. engine.rebase(snapshot)  — merge server message into base state
6. engine.commit(mutation.id) — remove from pending
7. storage.updateObjects() — React re-renders with confirmed state
8. SSE may also deliver message.created — engine.rebase() is idempotent
```

### Three Zustand Stores

**1. StorageStore** (wraps sync engine — primary data):
```typescript
{
  objects: engine.state,     // { channel: {...}, message: {...}, member: {...}, ... }
  mutate(name, input),       // optimistic mutation → engine.mutate + set
  updateObjects(),           // engine.state → set (after rebase/commit)
  rebaseLocal(snapshot),     // update localFields only
}
```

**2. UI Store** (purely client-side):
```typescript
{
  sidebarCollapsed: boolean,
  composerDrafts: Record<Id, string>,
  threadComposerDraft: string,
  activeModal: ModalType | null,
  searchOpen: boolean,
  searchQuery: string,
}
```

**3. AppController** (not a store, but owns both):
```typescript
class AppController {
  engine: SyncEngine<Schema>
  storage: ReturnType<typeof storageStoreCreate>  // Zustand store
  api: ApiClient
  // SSE, sequencer, sync methods...
}
```

### React Integration Pattern (from happy-list)
```typescript
// Provider (in root layout)
<AppContext.Provider value={controller}>
  {children}
</AppContext.Provider>

// In components
const app = useApp();                                    // AppController
const channels = useStorage((s) => s.objects.channel);   // reactive
const mutate = useStorage((s) => s.mutate);              // dispatch

mutate('messageSend', { id: cuid(), chatId, text });     // optimistic
```

### Design Token Migration
Existing CSS variables mapped to shadcn HSL system:
- `--background` ← `--bg` (#f4f1ec warm beige)
- `--primary` ← `--accent` (#d06a2d warm orange)
- `--destructive` ← `--danger` (#c44747 red)
- `--sidebar-*` ← `--sidebar` (#23282d), `--sidebar-ink`, `--sidebar-muted`
- Custom `--rail` (#161a1e) kept as additional tokens
- Fonts preserved: Karla (body), Bricolage Grotesque (display), IBM Plex Mono (mono)

### TanStack Router Auth Guard
```typescript
beforeLoad: ({ context }) => {
  if (!context.auth.token) throw redirect({ to: '/login' })
  if (!context.auth.orgId) throw redirect({ to: '/orgs' })
}
```

## Post-Completion

**Manual verification:**
- Test all flows on Chrome, Firefox, Safari
- Test responsive layout at 900px breakpoint
- Test with slow network (DevTools throttling) — verify optimistic UX
- Test with server down — verify graceful degradation
- Test SSE reconnection after network loss
- Test deep link sharing between users

**Future enhancements (not in scope):**
- Dark mode toggle
- Mobile-first responsive overhaul
- Push notifications (Web Push API)
- Markdown rendering
- Code syntax highlighting
- Message pinning and bookmarks
- Channel reordering
- Custom emoji upload
- Vim-style message navigation
- Offline mode with IndexedDB
