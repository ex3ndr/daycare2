# Web V2: Organization Settings, Invite Flows, Channel Enhancements & UX Polish

## Overview

Build the complete frontend for all server-v2 features plus significant UX improvements:

**Server-v2 features:**
- Org settings page (members, invites, domains, general settings editing)
- Org join flow for invited/domain-matched users
- Channel member management (add member to private channels)
- Deactivation handling

**UX & polish:**
- Profile editing (bio, avatar, timezone) + profile dropdown menu
- Org dropdown menu (in Rail or Sidebar header)
- Photo viewer / lightbox for image attachments
- Message grouping (consecutive messages from same sender collapse)
- Channel reordering (drag-and-drop or manual sort in sidebar)
- Search and filter for member/invite lists

### What exists today
- **Orgs page** (`/orgs`): lists orgs, create org dialog — no join flow for invited orgs
- **Workspace**: Rail (org avatar, switch org, logout) + Sidebar (channel list, create channel)
- **Channel page**: message list, composer, reactions, threads, edit/delete, file attachments
- **Channel settings**: dialog with overview (name/topic edit) + members tab (kick, role) — no add-member
- **Attachments**: inline image preview (opens in new tab), file download link — no lightbox
- **Messages**: each message shows full avatar/name row — no grouping for consecutive messages
- **No settings page**, no profile editing, no org/profile dropdown menus, no channel reordering

### What's new (full scope)
1. **Types & API client** — new types + methods for all server-v2 endpoints
2. **Orgs page join flow** — invited/domain-matched orgs shown as joinable
3. **Org settings page** (`/$orgSlug/settings`) — tabbed: General, Members, Invites, Domains
4. **Org general settings editing** — rename org, change avatar
5. **Profile dropdown menu** — in Rail, shows user info, opens profile editor
6. **Profile editing** — edit bio, avatar URL, timezone, first/last name
7. **Org dropdown menu** — in Sidebar header, links to settings, invite, members
8. **Channel info panel** — right-side panel with members, add member for private channels
9. **Photo viewer / lightbox** — click image attachment to open fullscreen overlay with zoom
10. **Message grouping** — consecutive messages from same sender within 5min collapse (no repeated avatar/name)
11. **Channel reordering** — drag-and-drop or manual up/down in sidebar
12. **Create channel visibility toggle** — public/private selector
13. **Search & filter** — filter member lists and invite lists by name/email
14. **Deactivation handling** — graceful redirect when current user is deactivated
15. **Channel settings enhancement** — add member to private channel from existing settings dialog

## Context (from discovery)

**Files involved:**
- `app/daycare/types.ts` — new types
- `app/daycare/api/apiClientCreate.ts` — new API methods
- `app/routes/orgs.tsx` — join flow
- `app/routes/_workspace.$orgSlug.settings.tsx` — new settings page
- `app/components/workspace/Rail.tsx` — gear icon, profile dropdown
- `app/components/workspace/Sidebar.tsx` — org dropdown, channel reorder, visibility toggle
- `app/components/workspace/ChannelSettings.tsx` — add member enhancement
- `app/components/settings/*` — new settings tab components
- `app/components/messages/MessageRow.tsx` — message grouping
- `app/components/messages/Attachment.tsx` — photo viewer trigger
- `app/components/ui/PhotoViewer.tsx` — new lightbox component
- `app/stores/uiStore.ts` — new state (photo viewer, channel order, panel)
- `app/sync/schema.ts` — channel order persistence

**Patterns:**
- TanStack Router, Zustand stores, shadcn/ui, `@slopus/sync`
- `useShallow` for derived selectors
- API calls through `apiClientCreate` returning typed responses

## Development Approach
- **Testing**: End-to-end verification with agent-browser skill
- Complete each task fully before moving to the next
- Run `yarn typecheck` after each task
- Test visually with `yarn web` against the public API server

## Progress Tracking
- Mark completed items with `[x]` immediately when done
- Add newly discovered tasks with ➕ prefix
- Document issues/blockers with ⚠️ prefix

---

## Implementation Steps

### Task 1: Update types and API client for server-v2

Add new types and API methods to match all server-v2 endpoints.

**Type additions to `app/daycare/types.ts`:**
```typescript
// Update User
orgRole: "owner" | "member";
deactivatedAt: UnixMs | null;

// New
OrgInvite { id, organizationId, invitedByUserId, email, status, expiresAt, acceptedAt, revokedAt, createdAt }
OrgDomain { id, organizationId, domain, createdByUserId, createdAt }
```

**New API methods:**
- `orgMemberDeactivate`, `orgMemberReactivate`, `orgMemberRoleSet`
- `orgInviteCreate`, `orgInviteList`, `orgInviteRevoke`
- `orgDomainAdd`, `orgDomainList`, `orgDomainRemove`
- `channelMemberAdd`
- `organizationUpdate` (for org name/avatar editing)
- Add `DELETE` method support to `apiRequest`

**Checklist:**
- [x] Add `orgRole` and `deactivatedAt` to `User` type
- [x] Add `OrgInvite` and `OrgDomain` types
- [x] Add all org member management methods to API client
- [x] Add all org invite methods to API client
- [x] Add all org domain methods to API client
- [x] Add `channelMemberAdd` and `organizationUpdate` methods
- [x] Add `DELETE` method support to `apiRequest`
- [x] Run `yarn typecheck` — must pass

### Task 2: Orgs page — joinable orgs with inline join flow

Show invited/domain-matched orgs on the orgs page with a join form.

**Changes to `routes/orgs.tsx`:**
- Use `organizationAvailableList` to get full list (includes invited + domain-matched)
- Also fetch current memberships to distinguish "my orgs" vs "available to join"
- Split into two sections: "Your Organizations" (click to enter) and "Available to Join" (join form)
- Clicking an available org expands an inline form: firstName + username → `organizationJoin`
- On join success → navigate into the org

**Checklist:**
- [x] Fetch both available orgs and current memberships
- [x] Split org list into two sections with headers
- [x] Add inline expandable join form for available orgs
- [x] Handle join errors (deactivated, conflict)
- [x] Run `yarn typecheck` — must pass

### Task 3: Org settings page — route, layout, and general tab

Create `/$orgSlug/settings` with tabbed navigation and org info editing.

**New files:**
- `app/routes/_workspace.$orgSlug.settings.tsx`
- `app/components/settings/SettingsLayout.tsx`
- `app/components/settings/SettingsGeneral.tsx`

**General tab features:**
- Show org name, slug, public/private status
- Editable fields for OWNER: org name, avatar URL
- Save button → `organizationUpdate` (new API endpoint, or `PATCH /api/org/:orgid` if server supports)
- Read-only for MEMBER role

**Navigation:**
- Add gear icon to Rail.tsx → navigates to `/$orgSlug/settings`
- Settings page has "← Back to workspace" link
- Tabs: General, Members, Invites, Domains (Invites/Domains management gated to OWNER)

**Checklist:**
- [x] Create settings route and register in router
- [x] Create `SettingsLayout.tsx` with tab navigation
- [x] Create `SettingsGeneral.tsx` with org info display + editing (OWNER)
- [x] Add gear icon button to Rail.tsx
- [x] Gate Invites/Domains management actions to OWNER role
- [x] Run `yarn typecheck` — must pass

### Task 4: Settings — Members tab with search/filter

Show all org members with management actions and search.

**New file:**
- `app/components/settings/SettingsMembers.tsx`

**Features:**
- Fetch members with `organizationMembers(token, orgId)`
- Search/filter input: filter by name or username (client-side)
- Show avatar, name, username, orgRole badge, active/deactivated status
- OWNER sees action dropdown per member:
  - Change role (OWNER ↔ MEMBER)
  - Deactivate member (with confirmation dialog)
  - Reactivate member (if deactivated)
- Deactivated members shown with muted style
- Cannot deactivate self

**Checklist:**
- [x] Create `SettingsMembers.tsx`
- [x] Add search/filter input for member list
- [x] Display members with role badges and status indicators
- [x] Add action dropdown for OWNER (role change, deactivate, reactivate)
- [x] Add confirmation dialog for deactivation
- [x] Handle API errors and loading states
- [x] Wire into SettingsLayout
- [x] Run `yarn typecheck` — must pass

### Task 5: Settings — Invites tab with search

Manage email invites with send form and list.

**New file:**
- `app/components/settings/SettingsInvites.tsx`

**Features:**
- Send invite form (OWNER only): email input + send button → `orgInviteCreate`
- List invites via `orgInviteList`, split into pending and past sections
- Search/filter by email
- Revoke button on pending invites (OWNER only)
- Status badges: pending (accent), accepted (success), revoked (danger), expired (neutral)
- Show expiry countdown for pending invites

**Checklist:**
- [x] Create `SettingsInvites.tsx`
- [x] Add invite form with email input (OWNER only)
- [x] Fetch and display invites, split pending vs past
- [x] Add search/filter by email
- [x] Add revoke action with confirmation
- [x] Show status badges and expiry info
- [x] Handle errors (duplicate, already member)
- [x] Wire into SettingsLayout
- [x] Run `yarn typecheck` — must pass

### Task 6: Settings — Domains tab

Manage allowed email domains for self-join.

**New file:**
- `app/components/settings/SettingsDomains.tsx`

**Features:**
- Add domain form (OWNER only): domain input + add button → `orgDomainAdd`
- Client-side validation (no @, lowercase, basic format check)
- List domains via `orgDomainList`
- Remove button (OWNER only) with confirmation → `orgDomainRemove`
- Show who added each domain

**Checklist:**
- [x] Create `SettingsDomains.tsx`
- [x] Add domain form with client-side validation
- [x] Fetch and display domain list
- [x] Add remove action with confirmation (OWNER only)
- [x] Wire into SettingsLayout
- [x] Run `yarn typecheck` — must pass

### Task 7: Profile dropdown menu and profile editor

Add a user profile dropdown in the Rail and a profile editing dialog.

**Changes:**
- **Rail.tsx**: Replace or augment the logout button area with a user avatar that opens a dropdown menu
- **Profile dropdown** shows: user display name, @username, org role badge, then menu items:
  - "Edit Profile" → opens profile editor dialog
  - "Switch Organization" → existing switch behavior
  - "Log Out" → existing logout behavior

**New file:**
- `app/components/workspace/ProfileEditor.tsx` — dialog for editing profile

**Profile editor fields:**
- First name, last name
- Username
- Bio (textarea)
- Timezone (text input or select)
- Avatar URL (text input — future: upload)
- Save → `profilePatch` API call

**Checklist:**
- [ ] Create profile dropdown menu in Rail.tsx (avatar + dropdown)
- [ ] Show user info (name, username, role) in dropdown header
- [ ] Move "Switch org" and "Log out" into dropdown as menu items
- [ ] Create `ProfileEditor.tsx` dialog with editable fields
- [ ] Wire save to `profilePatch` API
- [ ] Run `yarn typecheck` — must pass

### Task 8: Org dropdown menu in Sidebar header

Add a dropdown menu to the org name in the Sidebar header.

**Changes to `Sidebar.tsx`:**
- Make the org name header clickable → opens a dropdown menu
- Menu items:
  - "Settings" → navigate to `/$orgSlug/settings`
  - "Invite People" → navigate to `/$orgSlug/settings` (Invites tab) or open invite dialog
  - "Members" → navigate to `/$orgSlug/settings` (Members tab)
  - Separator
  - Org name + slug display (informational)

**Checklist:**
- [ ] Add dropdown trigger to org name in Sidebar header
- [ ] Add menu items: Settings, Invite People, Members
- [ ] Navigate to appropriate settings tab on click
- [ ] Run `yarn typecheck` — must pass

### Task 9: Channel settings — add member to private channel

Enhance the existing `ChannelSettings.tsx` dialog to support adding members to private channels.

**Changes to `ChannelSettings.tsx`:**
- In the members tab, if channel is private and current user is OWNER, show "Add Member" button
- Opens a sub-dialog or inline section listing org members not yet in the channel
- Search/filter by name
- Click a member → `channelMemberAdd(token, orgId, channelId, { userId })` → refresh member list

**New component (inline or separate):**
- `ChannelMemberAddSection` — searchable org member list, filtered to exclude existing channel members

**Checklist:**
- [ ] Add "Add Member" button to members tab (OWNER + private channel only)
- [ ] Fetch org members, filter out existing channel members
- [ ] Add search/filter input
- [ ] On member click → call `channelMemberAdd` → refresh list
- [ ] Handle errors (already member, deactivated user)
- [ ] Run `yarn typecheck` — must pass

### Task 10: Photo viewer / lightbox

Add a fullscreen photo viewer overlay when clicking image attachments.

**New file:**
- `app/components/ui/PhotoViewer.tsx`

**Features:**
- Click an image attachment → opens fullscreen overlay
- Dark backdrop with the image centered and scaled to fit
- Close on click outside, Escape key, or X button
- Zoom: click to toggle between fit-to-screen and actual size
- Navigation: if multiple images in same message, show prev/next arrows
- Download button
- File name and size displayed

**State:**
- Add `photoViewer: { open: boolean; url: string; fileName?: string } | null` to uiStore
- Or use a local portal-based component with context

**Changes to `Attachment.tsx`:**
- For previewable images: onClick → open PhotoViewer instead of `target="_blank"`

**Checklist:**
- [ ] Create `PhotoViewer.tsx` component with overlay, zoom, close, download
- [ ] Add state management for photo viewer (uiStore or local context)
- [ ] Update `Attachment.tsx` to open PhotoViewer on image click
- [ ] Add keyboard support (Escape to close, arrow keys for multi-image nav)
- [ ] Run `yarn typecheck` — must pass

### Task 11: Message grouping / collapsing

Collapse consecutive messages from the same sender within a time window.

**Changes to `MessageRow.tsx` and channel page:**
- When consecutive messages are from the same sender and within 5 minutes of each other, collapse:
  - First message: show full row (avatar + name + timestamp + text)
  - Subsequent messages: show compact row (no avatar/name, only text with hover-timestamp)
- Add a `isGrouped` prop to `MessageRow` (or compute in channel page)

**Implementation approach:**
- In the channel page's message rendering loop, detect groups:
  ```typescript
  const isGroupContinuation = i > 0
    && messages[i].senderUserId === messages[i-1].senderUserId
    && messages[i].createdAt - messages[i-1].createdAt < 5 * 60 * 1000
    && !messages[i-1].deletedAt;
  ```
- Pass `isGroupContinuation` to `MessageRow`
- In `MessageRow`: if grouped, render compact layout (indented text, no avatar, show timestamp on hover)

**Checklist:**
- [ ] Add grouping logic in channel page message loop
- [ ] Add `isGroupContinuation` prop to `MessageRow`
- [ ] Create compact message layout variant (no avatar/name, hover timestamp)
- [ ] Ensure grouping resets on: different sender, >5min gap, deleted message, thread indicator
- [ ] Apply same grouping in thread panel
- [ ] Run `yarn typecheck` — must pass

### Task 12: Channel reordering in sidebar

Allow users to reorder channels in the sidebar via drag-and-drop.

**Approach:**
- Store channel order in localStorage (per-org key: `daycare:channelOrder:${orgId}`)
- Default order: alphabetical (current behavior)
- Drag-and-drop using HTML5 drag API (no extra dependencies)
- When a channel is dragged to a new position, save the ordered array of channel IDs

**Changes to `Sidebar.tsx`:**
- Add `draggable` attribute to channel rows
- Handle `onDragStart`, `onDragOver`, `onDrop` events
- Visual indicator: drag handle icon on hover, drop target highlight
- Persist order to localStorage on drop
- New channels appear at the bottom of the custom order

**State:**
- `channelOrder: Record<string, string[]>` in uiStore (orgId → channelId[])
- Or simpler: just in localStorage, read on mount

**Checklist:**
- [ ] Add drag-and-drop handlers to channel rows in Sidebar
- [ ] Add visual drag handle + drop target indicator
- [ ] Persist channel order to localStorage per org
- [ ] Apply custom order when rendering (fall back to alphabetical for unordered)
- [ ] Handle new channels appearing (append to end of custom order)
- [ ] Run `yarn typecheck` — must pass

### Task 13: Create channel — visibility toggle

Add public/private selector to the create channel dialog.

**Changes to `Sidebar.tsx` `CreateChannelDialog`:**
- Add a toggle or radio group: Public / Private
- Pass `visibility` to `api.channelCreate` and sync mutation
- Show lock icon preview for private selection

**Checklist:**
- [ ] Add visibility selector (toggle/radio) to CreateChannelDialog
- [ ] Pass selected visibility to API call
- [ ] Update sync mutation to include visibility
- [ ] Show visual indicator (lock icon) for private
- [ ] Run `yarn typecheck` — must pass

### Task 14: Handle deactivation gracefully

When the current user is deactivated while in the workspace, handle it gracefully.

**Scenarios:**
1. SSE receives `organization.member.deactivated` where userId matches current user
2. Any API call returns 403 "Account has been deactivated"

**Handling:**
- On SSE deactivation event targeting current user: show toast message, destroy app, redirect to `/orgs`
- On 403 deactivation response: show error, clear org session, redirect to `/orgs`

**Checklist:**
- [ ] Add SSE event handler for `organization.member.deactivated` in event mappers
- [ ] Check if deactivated userId matches current user → toast + redirect
- [ ] Add global 403 deactivation error handler in API request layer
- [ ] Show user-friendly message ("You've been removed from this organization")
- [ ] Run `yarn typecheck` — must pass

### Task 15: Verify acceptance criteria
- [ ] Settings page has all four tabs (General editable, Members with search, Invites with search, Domains)
- [ ] OWNER-only actions are gated in UI
- [ ] Orgs page shows joinable orgs with inline join form
- [ ] Profile dropdown works (edit profile, switch org, logout)
- [ ] Org dropdown works (settings, invite, members links)
- [ ] Channel settings supports add-member for private channels
- [ ] Photo viewer opens on image click with zoom and close
- [ ] Message grouping collapses consecutive same-sender messages
- [ ] Channel reordering works via drag-and-drop
- [ ] Private channel creation works with visibility toggle
- [ ] Deactivation is handled gracefully
- [ ] Run `yarn typecheck`
- [ ] Test all flows with agent-browser

---

## Technical Details

### Route Structure (after changes)

```
/ (root)
├── / (index) → redirect
├── /login → email OTP
├── /orgs → org picker + join flow
└── /_workspace (layout)
    └── /$orgSlug (layout: Rail + Sidebar)
        ├── / (index) → "select a channel"
        ├── /c/$channelId → channel view
        │   └── /t/$threadId → thread panel
        ├── /dm/$dmId → DM
        │   └── /t/$threadId → DM thread
        ├── /search → search
        └── /settings → org settings (tabbed)   ← NEW
```

### New Component Tree

```
Rail.tsx (updated)
  ├── Org avatar button
  ├── Gear icon → settings
  └── Profile avatar → ProfileDropdownMenu
      ├── User info header
      ├── "Edit Profile" → ProfileEditor dialog
      ├── "Switch Organization"
      └── "Log Out"

Sidebar.tsx (updated)
  ├── Org header → OrgDropdownMenu
  │   ├── "Settings"
  │   ├── "Invite People"
  │   └── "Members"
  ├── Channels section (draggable rows)
  │   └── ChannelRow (with drag handle)
  └── "New Channel" → CreateChannelDialog (with visibility toggle)

ChannelPage (updated)
  ├── Header with info button
  ├── Messages (with grouping)
  │   └── MessageRow (isGroupContinuation variant)
  ├── Composer
  └── ChannelSettings dialog (with add-member for private)

Settings page (new)
  └── SettingsLayout
      ├── SettingsGeneral (editable org info)
      ├── SettingsMembers (with search + management)
      ├── SettingsInvites (with search + send/revoke)
      └── SettingsDomains (add/remove)

PhotoViewer (new, global overlay)
  └── Fullscreen image with zoom, nav, close, download

ProfileEditor (new, dialog)
  └── Form: name, username, bio, timezone, avatar URL
```

### Message Grouping Logic

```typescript
// In channel page render loop
messages.map((msg, i) => {
  const prev = messages[i - 1];
  const isGroupContinuation =
    i > 0
    && prev.senderUserId === msg.senderUserId
    && !prev.deletedAt
    && msg.createdAt - prev.createdAt < 5 * 60 * 1000;

  return (
    <MessageRow
      key={msg.id}
      message={msg}
      isGroupContinuation={isGroupContinuation}
      // ...other props
    />
  );
});
```

### Channel Reorder Persistence

```typescript
// localStorage key per org
const KEY = `daycare:channelOrder:${orgId}`;

// Read
const order: string[] = JSON.parse(localStorage.getItem(KEY) ?? "[]");

// Apply: channels sorted by position in order array, unordered appended alphabetically
function sortChannels(channels: Channel[], order: string[]): Channel[] {
  const indexed = new Map(order.map((id, i) => [id, i]));
  return [...channels].sort((a, b) => {
    const ai = indexed.get(a.id) ?? Infinity;
    const bi = indexed.get(b.id) ?? Infinity;
    if (ai === Infinity && bi === Infinity) return a.name.localeCompare(b.name);
    return ai - bi;
  });
}
```

### Permission Gating Pattern

```typescript
const orgRole = useStorage((s) => s.objects.context.orgRole);
const isOwner = orgRole === "owner";

// Gate UI
{isOwner && <Button>Send Invite</Button>}
{isOwner && <DropdownMenuItem>Deactivate</DropdownMenuItem>}
```

### Photo Viewer State

```typescript
// In uiStore
photoViewer: {
  url: string;
  fileName: string | null;
  images: Array<{ url: string; fileName: string | null }>; // for multi-image nav
  currentIndex: number;
} | null;

photoViewerOpen: (images, startIndex) => void;
photoViewerClose: () => void;
photoViewerNext: () => void;
photoViewerPrev: () => void;
```

## Post-Completion

**Manual verification (with agent-browser):**
- Full invite flow: send invite → log in as invited user → see org → join
- Domain flow: add domain → matching user sees org → joins
- Member management: deactivate → reactivate → verify access
- Private channel: create → add member → verify
- Profile editing: change name/bio → verify persists
- Photo viewer: upload image → click → lightbox opens → zoom → close
- Message grouping: send multiple messages → verify collapsed display
- Channel reorder: drag channel → verify order persists across refresh
- Org dropdown: click org name → see menu → navigate to settings
- Profile dropdown: click avatar → see menu → edit profile
