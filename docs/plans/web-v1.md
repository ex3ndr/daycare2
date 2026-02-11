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

### State Layer
```
┌─────────────────────────────────────────────────┐
│  @slopus/sync (primary state)                   │
│  ┌───────────┐ ┌──────────┐ ┌────────────────┐  │
│  │ channels  │ │ messages │ │ members        │  │
│  │ (type)    │ │ (type)   │ │ (type)         │  │
│  └───────────┘ └──────────┘ └────────────────┘  │
│  ┌───────────┐ ┌──────────┐ ┌────────────────┐  │
│  │ readState │ │ typing   │ │ session        │  │
│  │ (type)    │ │ (type)   │ │ (object)       │  │
│  └───────────┘ └──────────┘ └────────────────┘  │
│  mutations: messageSend, channelCreate, ...     │
│  rebase(): called when SSE/diff brings server   │
│            state → replays pending mutations     │
│  commit(): called when server confirms mutation  │
└─────────────────────────────────────────────────┘
          ↕ reads/writes
┌─────────────────────────────────────────────────┐
│  Zustand (UI-only state)                        │
│  composerDrafts, sidebarCollapsed,              │
│  modalState, searchQuery                        │
└─────────────────────────────────────────────────┘
          ↕ subscriptions
┌─────────────────────────────────────────────────┐
│  React hooks                                    │
│  useSyncState() — reads from sync engine        │
│  useUiStore()   — reads from Zustand            │
│  useMutation()  — wraps sync engine mutate()    │
└─────────────────────────────────────────────────┘
```

### Transport Layer
```
┌──────────────────────────────────────┐
│  syncBridge (new)                    │
│  SSE stream ← server pushes updates │
│  diff endpoint ← catch-up on gaps   │
│  REST calls → mutations to server   │
│                                      │
│  On SSE event:                       │
│    1. Update sync engine via rebase  │
│    2. Sync engine replays pending    │
│    3. React re-renders from state    │
│                                      │
│  On mutation:                        │
│    1. Sync engine applies optimistic │
│    2. React re-renders immediately   │
│    3. REST call to server            │
│    4. On success: commit()           │
│    5. On failure: rollback           │
└──────────────────────────────────────┘
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

- [ ] Delete `app/compontnes/` directory entirely (13 custom components with typo in name)
- [ ] Delete `app/daycare/ui/daycareAppUse.ts` (monolithic state hook)
- [ ] Delete `app/daycare/sync/syncEngineCreate.ts` (old sync engine)
- [ ] Delete `app/main.tsx` (old single-component entry point)
- [ ] Delete `app/styles.css` (custom stylesheet — will be rebuilt)
- [ ] Verify what remains:
  - `app/daycare/api/apiClientCreate.ts` (keep)
  - `app/daycare/api/apiRequest.ts` (keep)
  - `app/daycare/api/sseSubscribe.ts` (keep)
  - `app/daycare/types.ts` (keep)
  - Config files (keep)
- [ ] Create minimal `app/main.tsx` placeholder: renders `<div>Daycare</div>` so the app builds
- [ ] Create minimal `app/styles.css` with only the CSS variable design tokens (`:root` block with `--bg`, `--accent`, `--rail`, `--sidebar`, fonts, radii) and Google Fonts import — no component classes
- [ ] Verify `yarn typecheck` passes
- [ ] **agent-browser**: open `http://localhost:7332`, verify placeholder renders, take screenshot

#### Task 2: Install dependencies

- [ ] Install runtime deps: `zustand`, `@slopus/sync`, `@tanstack/react-router`, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`
- [ ] Install shadcn deps: `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-popover`, `@radix-ui/react-tooltip`, `@radix-ui/react-scroll-area`, `@radix-ui/react-separator`, `@radix-ui/react-avatar`, `@radix-ui/react-slot`
- [ ] Install test deps: `vitest`, `jsdom`
- [ ] Verify `yarn typecheck` still passes after install

#### Task 3: Configure shadcn + Tailwind + Vitest

- [ ] Create `app/lib/utils.ts` with `cn()` helper (clsx + tailwind-merge)
- [ ] Update `tailwind.config.ts` — map Daycare warm palette into shadcn HSL variable format (`--background` ← beige, `--primary` ← orange, `--destructive` ← red, `--sidebar-*` ← dark tones)
- [ ] Update `app/styles.css` — add shadcn CSS variables (`:root` and `.dark`) using the warm palette, keep Google Fonts import, keep body background gradient
- [ ] Create `components.json` for shadcn CLI configuration
- [ ] Create `packages/daycare-web/vitest.config.ts` with jsdom environment and path aliases
- [ ] Update `package.json` test script: `"test": "vitest run"`
- [ ] Write smoke test `app/lib/utils.spec.ts` testing `cn()` utility
- [ ] Run tests — must pass

---

### Milestone 2: shadcn Component Library

Build all UI primitives before any views. Components are testable in isolation.

#### Task 4: Add shadcn base components

- [ ] Create `app/components/ui/` directory
- [ ] Add components:
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
- [ ] Create temporary test page in `app/main.tsx` that renders all components with variant/size combinations
- [ ] **agent-browser**: open test page, screenshot each component group, verify warm palette applied (orange primary, beige background, dark sidebar tones)
- [ ] Verify `yarn typecheck` passes

---

### Milestone 3: State Layer (@slopus/sync + Zustand)

Build the complete data layer before any views. Fully testable with Vitest.

#### Task 5: Define sync schema

Define the @slopus/sync schema that models all server-synced state.

- [ ] Create `app/sync/schema.ts` — define schema using `defineSchema()`:
  - **Collections** (type, ID-indexed):
    - `channels` — `{ id, name, topic, visibility, createdAt, updatedAt }` + localField `isJoined`
    - `messages` — `{ id, channelId, senderUserId, threadId, text, createdAt, editedAt, deletedAt, threadReplyCount, threadLastReplyAt, sender, attachments, reactions }` + localField `pending`
    - `members` — `{ id, kind, username, firstName, lastName, avatarUrl }`
    - `readStates` — `{ chatId, lastReadAt, unreadCount }`
    - `typingStates` — `{ key, userId, username, firstName, expiresAt }`
  - **Singletons** (object):
    - `session` — `{ token, accountId, orgId, userId }` + localField `phase`
    - `activeOrg` — `{ id, slug, name, avatarUrl }`
    - `activeUser` — `{ id, kind, username, firstName, lastName, avatarUrl }`
  - **Mutations** (defined via `.withMutations()`):
    - `messageSend` — optimistically add message with `pending: true`
    - `messageEdit` — optimistically update message text + editedAt
    - `messageDelete` — optimistically set deletedAt
    - `reactionToggle` — optimistically add/remove reaction
    - `channelCreate` — optimistically add channel
    - `readMark` — optimistically set lastReadAt and zero unreadCount
    - `typingAdd` / `typingRemove` — manage typing indicators
- [ ] Write tests for schema (verify collections, singletons, mutations produce correct initial state)
- [ ] Run tests — must pass before next task

#### Task 6: Create sync bridge (transport ↔ sync engine)

Bridge SSE/diff transport with @slopus/sync. Server events trigger `rebase()`, mutations trigger REST calls.

- [ ] Create `app/sync/syncBridge.ts`:
  - Initialize @slopus/sync engine from schema
  - On SSE event: map payload to `rebase()` call
    - `message.created` → rebase messages collection
    - `message.updated` / `message.deleted` / `message.reaction` → rebase message
    - `channel.created` / `channel.updated` → rebase channels
    - `member.joined` / `member.left` → rebase members
    - `user.typing` → rebase typing states
  - On mutation (e.g. `messageSend`):
    - `engine.mutate('messageSend', input)` → optimistic update
    - Call REST API
    - On success: `engine.commit(mutationId)`
    - On failure: rollback on next rebase
  - Expose `engine.state` and `engine.pendingMutations`
- [ ] Create `app/sync/eventMappers.ts` — pure functions mapping `UpdateEnvelope` payloads to rebase data
- [ ] Write tests for `eventMappers` (each event type → correct rebase shape)
- [ ] Write tests for mutation flow (mutate → optimistic state → commit → confirmed state)
- [ ] Run tests — must pass before next task

#### Task 7: Create Zustand UI store

Thin store for client-only UI state.

- [ ] Create `app/stores/uiStore.ts`:
  - `sidebarCollapsed: boolean`
  - `composerDrafts: Record<channelId, string>` — per-channel draft text
  - `threadComposerDraft: string`
  - `activeModal: 'createOrg' | 'createChannel' | 'channelSettings' | 'userProfile' | null`
  - `searchOpen: boolean`
  - `searchQuery: string`
  - Actions: `sidebarToggle`, `composerDraftSet`, `modalOpen`, `modalClose`, `searchToggle`
- [ ] Create `app/stores/uiStoreUse.ts` — typed selector hooks
- [ ] Write tests for uiStore (set/get/clear for each field)
- [ ] Run tests — must pass before next task

#### Task 8: Create React hooks for sync engine

Hooks that connect React to the sync engine + Zustand.

- [ ] Create `app/sync/SyncProvider.tsx` — React context holding sync engine + bridge instance
- [ ] Create `app/sync/syncStateUse.ts` — `useSyncState(selector)` hook (uses `useSyncExternalStore`)
- [ ] Create `app/sync/syncMutationUse.ts` — `useMutation(name)` hook wrapping mutate + API call + commit/rollback
- [ ] Create derived selectors:
  - `channelsForCurrentOrg()` — channels filtered by active org
  - `messagesForChannel(channelId)` — sorted by createdAt
  - `threadMessagesForRoot(threadId)` — thread replies sorted
  - `unreadCountForChannel(channelId)` — from readStates
  - `typingUsersForChannel(channelId)` — filtered, exclude self, exclude expired
- [ ] Write tests for derived selectors (given mock state → expected output)
- [ ] Run tests — must pass before next task

---

### Milestone 4: Routing + Session

#### Task 9: TanStack Router setup

- [ ] Create route tree in `app/routes/`:
  - `__root.tsx` — root layout with SyncProvider, error boundary
  - `login.tsx` — `/login`
  - `orgs.tsx` — `/orgs`
  - `_workspace.tsx` — layout route (rail + sidebar chrome)
  - `_workspace.$orgSlug.tsx` — org workspace layout
  - `_workspace.$orgSlug.c.$channelId.tsx` — channel view
  - `_workspace.$orgSlug.c.$channelId.t.$threadId.tsx` — thread panel
  - `_workspace.$orgSlug.dm.$dmId.tsx` — DM view
  - `_workspace.$orgSlug.search.tsx` — search results
  - `index.tsx` — `/` redirect
- [ ] Create `app/router.ts` — router instance with route tree
- [ ] Update `app/main.tsx` — render `<RouterProvider>` instead of placeholder
- [ ] Implement route guards: redirect `/login` if no token, `/orgs` if no org
- [ ] Write tests for route guard logic (pure function: auth state → redirect path)
- [ ] Run tests — must pass before next task

#### Task 10: Session persistence

- [ ] Create `app/lib/sessionStore.ts` — read/write `{ token, accountId }` to localStorage key `daycare:session`
- [ ] Create `app/lib/sessionRestore.ts` — on load, read session, validate via `GET /api/me`, restore or clear
- [ ] Wire into route guards: login stores token, logout clears token
- [ ] Write tests for `sessionStore` (get/set/clear, handles corrupt data)
- [ ] Write tests for `sessionRestore` logic (valid token, expired, missing)
- [ ] Run tests — must pass before next task

---

### Milestone 5: Core Views

Build every screen. After this milestone the app is fully functional for core messaging.

#### Task 11: Auth screen (`/login`)

- [ ] Build `app/routes/login.tsx` using shadcn Card, Input, Button, Badge
- [ ] Login flow: email input → `POST /api/auth/login` → store token → redirect to `/orgs`
- [ ] Loading state (Button disabled + spinner)
- [ ] Error display (inline error message)
- [ ] Daycare warm aesthetic (gradient background, grain overlay, centered card)
- [ ] **agent-browser**: navigate to `/login`, enter integration test email, submit, verify redirect to `/orgs`, screenshot login card and loading state
- [ ] Run tests — must pass before next task

#### Task 12: Organization picker (`/orgs`)

- [ ] Build `app/routes/orgs.tsx` — list orgs from `GET /api/me`, click to enter workspace
- [ ] "Create Organization" Dialog with form fields (name, slug, firstName, username)
- [ ] On org click: load org → start sync engine → redirect to `/:orgSlug`
- [ ] On create: create org → start sync → redirect
- [ ] **agent-browser**: login → arrive at `/orgs` → screenshot org list → create new org → verify redirect to workspace → screenshot
- [ ] Run tests — must pass before next task

#### Task 13: Workspace layout (`_workspace` route)

The workspace chrome: rail, sidebar, content area, thread panel.

- [ ] Build `app/routes/_workspace.tsx` — CSS Grid layout (rail 76px, sidebar 280px, content 1fr, thread 320px)
- [ ] Build `app/components/workspace/Rail.tsx` — org avatar, org switcher, logout (dark background)
- [ ] Build `app/components/workspace/Sidebar.tsx` — org name, user info, channel list, DM section (dark background)
- [ ] Channel list: ScrollArea, clickable rows with unread Badge, active highlight
- [ ] "New Channel" button → Dialog
- [ ] Routing: channel click → `/:orgSlug/c/:channelId`
- [ ] **agent-browser**: verify 4-column layout (dark rail, dark sidebar, light chat, light thread), click channels and verify URL changes, screenshot full workspace, verify unread badges show on non-selected channels
- [ ] Run tests — must pass before next task

#### Task 14: Channel view (messages + composer)

The main messaging view.

- [ ] Build `app/routes/_workspace.$orgSlug.c.$channelId.tsx`:
  - Channel header (name, topic, sync status badge)
  - Message list in ScrollArea with auto-scroll to bottom
  - Typing indicator line
  - Composer: Textarea + Send Button, Enter to send, Shift+Enter newline
- [ ] Build `app/components/messages/MessageRow.tsx` — avatar, author name + handle + timestamp, text, reaction badges, thread button
- [ ] Build `app/components/messages/Composer.tsx` — connected to `messageSend` mutation
- [ ] Optimistic send: message appears immediately with `pending` badge, resolves on commit
- [ ] Typing signals: emit on keystroke (throttled 1.5s), show typing users from sync state
- [ ] Read marking: mark read on channel select + on new messages while viewing
- [ ] **agent-browser**: type a message → hit Enter → verify message appears instantly with "sending" badge → wait for badge to disappear (SSE confirm) → screenshot. Open second tab, send message there, verify it appears in first tab via SSE.
- [ ] Run tests — must pass before next task

#### Task 15: Thread panel

- [ ] Build `app/routes/_workspace.$orgSlug.c.$channelId.t.$threadId.tsx`:
  - Thread root message at top
  - Thread replies in ScrollArea
  - Thread composer
  - Close button → navigate back to channel
- [ ] Thread opens via "Thread" button on message → thread URL
- [ ] Replies use `messageSend` mutation with `threadId`
- [ ] **agent-browser**: click "Thread" on a message → verify thread panel opens with root message at top and URL updates → type reply → verify it appears → click Close → verify panel closes and URL reverts → screenshot open and closed states
- [ ] Run tests — must pass before next task

---

### Milestone 6: Feature Completion

#### Task 16: Message edit and delete UI

- [ ] Add "Edit" / "Delete" to message context menu (DropdownMenu on hover)
- [ ] Edit: inline edit mode — text becomes editable Textarea, save/cancel buttons
- [ ] Edit uses `messageEdit` mutation (optimistic: text + editedAt update immediately)
- [ ] Delete: confirmation Dialog, then `messageDelete` mutation (optimistic: set deletedAt)
- [ ] Show "(edited)" indicator on edited messages
- [ ] Show deleted messages as "[This message was deleted]" or hide
- [ ] Only show edit/delete for own messages
- [ ] **agent-browser**: hover a message → verify context menu appears → click Edit → verify inline textarea with old text → change text → save → verify "(edited)" label appears instantly (optimistic) → screenshot. Click Delete on another message → confirm dialog → verify message disappears → screenshot.
- [ ] Run tests for edit/delete mutations — must pass before next task

#### Task 17: Emoji reactions

- [ ] Build `app/components/messages/ReactionBar.tsx` — existing reactions as clickable Badges with count, highlighted if user reacted
- [ ] Build `app/components/messages/EmojiPicker.tsx` — Popover with grid of common shortcodes (`:thumbsup:`, `:fire:`, `:heart:`, `:laugh:`, `:eyes:`, `:check:`, `:clap:`, `:rocket:`, `:thinking:`, `:100:`)
- [ ] Click existing reaction → toggle (add/remove via `reactionToggle` mutation)
- [ ] "+" button → EmojiPicker for new reaction
- [ ] Optimistic: reaction appears/disappears immediately
- [ ] **agent-browser**: click "+" on a message → verify emoji picker popover → click `:fire:` → verify reaction badge appears with count 1 and highlighted → click it again → verify it disappears → screenshot picker open and reaction states
- [ ] Run tests for reaction toggle logic — must pass before next task

#### Task 18: Direct messages UI

Depends on backend DM API routes.

- [ ] DM section in Sidebar: list DMs showing other user's avatar + name
- [ ] "New Message" button → Dialog with member list
- [ ] Build `app/routes/_workspace.$orgSlug.dm.$dmId.tsx` — same message view but DM header (user avatar + name)
- [ ] DM creation → `POST /api/org/:orgid/directs` → navigate to DM route
- [ ] Same message list and composer components
- [ ] **agent-browser**: click "New Message" in sidebar → select a member → verify DM opens with user's name as header → send a message → verify it appears → check sidebar shows DM in list → screenshot
- [ ] Run tests — must pass before next task

#### Task 19: File upload UI

Depends on backend S3 integration.

- [ ] Build `app/components/messages/FileUpload.tsx` — drop zone + file picker in composer area
- [ ] Upload flow: select file → `upload-init` → `upload` (base64) → include fileId in message
- [ ] Progress indicator (pending → uploading → ready)
- [ ] Attached files as chips below composer before sending
- [ ] Build `app/components/messages/Attachment.tsx` — image preview, file icon + name for documents
- [ ] Drag-and-drop support onto message area
- [ ] **agent-browser**: click file picker → select an image → verify chip appears below composer with progress → send message → verify image preview renders in message → screenshot composer with attachment and sent message with preview
- [ ] Run tests for upload state machine — must pass before next task

#### Task 20: Infinite scroll / message pagination

- [ ] Scroll-to-top loads older messages via `before` cursor
- [ ] "Jump to bottom" button when scrolled up + new messages arrive
- [ ] Auto-scroll to bottom on new messages only if already at bottom
- [ ] Merge paginated messages into sync engine state via rebase
- [ ] Loading spinner at top while fetching
- [ ] **agent-browser**: in a channel with many messages, scroll to top → verify spinner appears → verify older messages load → scroll to middle → send message from second tab → verify "jump to bottom" button appears → click it → verify scroll snaps to newest message → screenshot
- [ ] Run tests — must pass before next task

#### Task 21: Search UI

Depends on backend full-text search.

- [ ] Build `app/routes/_workspace.$orgSlug.search.tsx` — search results page
- [ ] Cmd+K → Command palette, search messages + channels
- [ ] Message results: text with highlight, channel, author, timestamp
- [ ] Channel results: name + topic
- [ ] Click message → navigate to channel at that message (`around` pagination)
- [ ] Click channel → navigate to channel
- [ ] **agent-browser**: press Cmd+K → verify command palette opens → type search term → verify results appear with highlights → click a message result → verify navigation to correct channel and message is visible → screenshot palette and result navigation
- [ ] Run tests — must pass before next task

#### Task 22: User presence indicators

Depends on backend presence system.

- [ ] Presence dot on Avatar (green = online, yellow = away, gray = offline)
- [ ] Fetch presence for visible members
- [ ] Heartbeat every 60 seconds
- [ ] Listen for `user.presence` SSE events → update sync state
- [ ] Show in: member list, DM sidebar, message avatars
- [ ] **agent-browser**: login in two tabs with different users → verify green presence dots on both users' avatars → close one tab → wait 30s → verify dot turns gray on the remaining tab → screenshot both states
- [ ] Run tests — must pass before next task

#### Task 23: Channel settings and member management

- [ ] Build `app/components/workspace/ChannelSettings.tsx` — Dialog with tabs:
  - Overview: editable name, topic, visibility
  - Members: list with role badges, kick (owner), role change (owner)
- [ ] Open via channel header settings icon
- [ ] Archive/unarchive button (owner, depends on backend)
- [ ] Notification preferences dropdown (ALL / MENTIONS_ONLY / MUTED)
- [ ] **agent-browser**: click settings icon in channel header → verify dialog opens with Overview tab → edit channel name → save → verify header updates → switch to Members tab → verify member list with role badges → screenshot both tabs
- [ ] Run tests — must pass before next task

---

### Milestone 7: Polish and Verification

#### Task 24: Keyboard shortcuts

- [ ] `Enter` — send message
- [ ] `Shift+Enter` — newline
- [ ] `Cmd+K` / `Ctrl+K` — open search
- [ ] `Escape` — close thread/modal/search
- [ ] `Up Arrow` (empty composer) — edit last own message
- [ ] `Cmd+/` — keyboard shortcut help overlay
- [ ] **agent-browser**: press Cmd+K → verify search opens → press Escape → verify it closes → press Up in empty composer → verify edit mode on last message → press Cmd+/ → verify help overlay → screenshot each

#### Task 25: Error handling and loading states

- [ ] Error boundary at route level (catch errors, show retry UI)
- [ ] Loading skeletons for channel list, message list, thread panel
- [ ] Toast notifications for send failed, connection lost, reconnected
- [ ] SSE disconnect: "Reconnecting..." banner, auto-retry
- [ ] 401 responses: clear session, redirect to login
- [ ] **agent-browser**: stop the API server → verify "Reconnecting..." banner appears → restart server → verify banner disappears and messages reload → screenshot reconnection state. Navigate to a channel → verify loading skeletons show briefly before messages appear → screenshot skeleton state.

#### Task 26: Verify acceptance criteria

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

#### Task 27: [Final] Update documentation

- [ ] Update CLAUDE.md with new web architecture (shadcn, TanStack Router, @slopus/sync, Zustand)
- [ ] Update `packages/daycare-web/package.json` description
- [ ] Document route structure
- [ ] Update `app/daycare/types.ts` with any new types

## Technical Details

### @slopus/sync Integration
- Schema defines collections (channels, messages, members, readStates, typingStates) and singletons (session, activeOrg, activeUser)
- Mutations defined inline with schema for full type inference
- `mutate()` applies optimistic change, returns `mutationId`
- `rebase()` called on every SSE event — replays pending mutations on new server state
- `commit(mutationId)` after REST API confirms success
- On API failure: mutation removed on next rebase (automatic rollback)
- `localField` for UI-only state on synced objects (e.g. `message.pending`, `channel.isJoined`)

### Optimistic Mutation Flow (messageSend)
1. User hits Enter
2. `engine.mutate('messageSend', { channelId, text, tempId })` → message in state with `pending: true`
3. React re-renders immediately
4. `api.messageSend(...)` called in background
5. Server responds with real message
6. `engine.commit(mutationId)` clears pending
7. SSE delivers `message.created` → `engine.rebase()` adds real message
8. Pending message replaced by real message

### Zustand Store Structure
```typescript
{
  sidebarCollapsed: boolean;
  composerDrafts: Record<Id, string>;
  threadComposerDraft: string;
  activeModal: ModalType | null;
  searchOpen: boolean;
  searchQuery: string;
}
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
