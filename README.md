# Daycare Backend Specification (v1)

AI-first messenger, Slack-like architecture with first-class AI agent participation.

## 1. Goal

Minimal backend for an AI-first messenger:
- channels and direct chats;
- text messages with attachments, reactions, and mentions;
- threads within channels and direct chats;
- simple and predictable protocol;
- priority on reliable update delivery and easy client synchronization.

## 2. Architecture

Monorepo with two packages:

- **daycare-server** — API server. TypeScript, ESM, Fastify.
- **daycare-web** — SPA client. TypeScript, Vite, React.

Server owns all state; client is a thin UI that subscribes to events.
Realtime transport is **SSE only** in v1. WebSockets are out of scope.

## 3. Tech Stack

- Node.js 22+
- Fastify
- Zod (validation of all API input/output schemas)
- Prisma ORM v7
- Redis (latest)
- Docker Compose for local and production environments

Additionally for Prisma:
- primary DB: PostgreSQL (recommended for production);
- Prisma Migrate for migrations.

## 4. Docker Compose Setup

Services in `docker-compose.yml`:
- `api` (Fastify backend)
- `db` (PostgreSQL)
- `redis` (latest)
- `s3` (S3-compatible storage, e.g. MinIO)

Optional for dev:
- `mailhog`/`smtp` for testing email OTP.

## 4.1 Development

See `docs/development.md` for local setup, migrations, seed data, and test flows.

## 4.2 Deployment

See `docs/deployment.md` for Kubernetes manifests and required environment variables.

## 5. Constraints and Assumptions

- Each organization has a limited number of users (target: < 5000).
- This allows a simplified realtime model:
  - SSE updates can be broadcast to all users in the organization;
  - additional routing/filtering is allowed but not required.
- Push notifications are not implemented in v1.
- Typing indicators are persisted with a short TTL and delivered via SSE updates.
- Calls and voice messages are not implemented.

## 6. Server Project Structure

Three main folders inside `sources/`:

```
sources/
├── apps/       # applications — individual messenger features
├── modules/    # reusable modules (not domain-specific)
└── utils/      # utilities
```

### 6.1 apps/

Each folder in `apps/` is a separate feature/application:

- **`api/`** — HTTP API. Contains: Fastify server initialization, subfolders with all route definitions.
- **`users/`** — user management: profile creation, name/avatar changes, permissions, etc.

### 6.2 modules/

Modules are isolated integrations, algorithms, or approaches that are **not** domain-specific. They are reused by applications in `apps/`. Examples:

- Message delivery (event-bus, simple wrapper).
- Database (connection, helpers).
- Email sending (Resend integration).
- Redis (connection, pub/sub).
- S3 (file upload/download).

### 6.3 utils/

Pure utility functions with no side-effects.

## 7. Server Bootstrap

A single async `main` function that sequentially executes:
1. Connect to DB (Prisma).
2. Connect to Redis.
3. Connect to S3.
4. Initialize modules.
5. Start API server (Fastify).

Reuse existing code from other projects as much as possible — don't reinvent what's already well-solved.

## 8. Specific Technical Decisions

- **Email OTP**: sent via **Resend**.
- **Tokens**: use **privacy-kit** (`createPersistentTokenGenerator` / `createPersistentTokenVerifier`) for token generation and verification. Import as a library — no custom JWT infrastructure.
- **All IDs**: **CUID2**, especially public ones and in the database.

## 9. Multi-Organization

- A single user can belong to multiple organizations.
- `User` entity has a profile that is always filled (no separate `Account`/`Profile` split).
- User is linked to email (for authentication) and scoped to an organization with its own name, avatar, etc.
- After authentication, the user selects an organization; if no user exists in it — creates one.
- In the app, a user works with **one** organization at a time (keep it simple).
- By default, any user can join any organization. No complex admin controls for now.

## 10. Chat Model

Core entities:
- `Organization`
- `User` (scoped to an organization, profile always filled)
- `Channel` (public/private)
- `DirectChat` (direct message)
- `Message`
- `Thread` (message replies within a channel or direct chat)

Chat behavior closely follows Slack:
- channels;
- direct chats;
- threads (replies nested under a parent message).

### 10.1 Users

Two kinds of participants:
- **human** — real person, authenticates via email OTP.
- **ai** — AI agent, created as a system prompt and a profile. Does not actively connect or react in v1 — just a definition that the server can invoke in the future.

Required profile fields: `firstName`, `username`.
Optional: `lastName`, bio, timezone, avatar, etc.
AI users have an additional `systemPrompt` field.

### 10.2 AI Agents

AI agents are defined as system prompts and profiles. They exist as `User` records with `kind: "ai"` and a `systemPrompt` field describing their behavior.

In v1, agents do not connect to the server or actively react to events. They are passive definitions. In the future, agents may subscribe to SSE streams and react to mentions and messages via REST commands.

### 10.3 Typing Events

Typing indicators are persisted as short-lived state and delivered via SSE:
- Client sends a typing signal to the server with `chatId` (REST endpoint).
- Server stores typing state with TTL and broadcasts `user.typing` updates to chat members via SSE.
- Expired typing states are cleaned automatically by TTL.
- Client-side timeout: show "typing" for **5 seconds** after the last event.

## 11. Authentication

- Email OTP only (one-time password via email, sent through Resend).
- No other sign-in methods in v1.
- After OTP verification, a token is issued using **privacy-kit** (`createPersistentTokenGenerator`).
- Token is passed as Bearer in the `Authorization` header.

## 12. Reliable Update Delivery

All user-facing state changes must be delivered reliably through the persisted update stream (see section 18). This includes:
- Profile changes (name, avatar, any other fields).
- Channel membership changes.
- Message events (created, edited, deleted).
- Online status changes.

Updates are persisted on the backend and delivered via `diff` + `stream`. The client can always catch up after a disconnect.

## 13. Online Status

Online statuses follow a Telegram-like approach:
- Online statuses are tracked in **Redis**.
- Server delivers status changes as persisted updates to all organization members.
- Clients ping the server every **15 seconds**.
- Timeout (transition to offline): **30 seconds** without a ping.
- `User` object includes a `status` field: `online`, `offline`, or `lastSeenAt` (unix ms).
- Status changes are delivered as `user.status` updates through the update stream.

## 14. Channels

- Users can **join** and **leave** channels.
- Channel search is available to all organization members.
- Operations: create, rename, list channels, join, leave, list members.

## 15. Messages

Basic operations:
- Send a message.
- Retrieve messages (paginated, cursor-based).
- Edit a message.
- Delete a message.

Message retrieval supports **bidirectional pagination**:
- **Newest-first**: load from the end (default for opening a chat).
- **Before a message**: load older messages from a given `messageId`.
- **After a message**: load newer messages from a given `messageId`.
- **Around a message**: load messages centered on a given `messageId` (for jumping to a specific message, e.g. from search or a link).

New messages are broadcast to all channel members via the update stream.

### 15.1 Threads

- Any message can be a thread root.
- Replies reference a `threadId` (the root message ID).
- Thread replies are fetched via the same messages endpoint with a `threadId` filter.
- Thread reply count and latest reply timestamp are denormalized on the root message.
- New thread replies generate an update for thread subscribers.

### 15.2 Attachments

- Maximum **10 attachments** per message.
- Attachment types (extensible):
  - Images (image).
  - Documents (document).
  - Audio (audio).
- The attachment type system must be **extensible** — easy to add new types in the future.

### 15.3 Reactions

- Format: Slack-style shortcodes — `:emoji_name:` (e.g. `:thumbsup:`, `:fire:`).
- Designed for future custom organization emoji support.

### 15.4 Mentions

- **Mention parsing is done exclusively on the server**, not the client.
- Client sends raw text.
- Server parses the text and extracts all user mentions.

### 15.5 Text Format

- Client sends text in **Slack-flavored markdown** format.
- Complex markdown is not needed for now.

## 16. Unread Messages

- Separate unread counters are not stored or incremented per message.
- The count is always computed on load:
  - from the total number of messages after the user's read position.
- For each user in each chat, a read state is stored as `lastReadAtMs` — the server-assigned timestamp (unix ms) of the last read message.
- Time is assumed to be monotonic; backend assigns server timestamps in unix ms.

## 17. Chat Notification Settings

Each user in each chat has notification settings (client-side behavior):
- all messages
- mentions only
- mute for:
  - 1 hour
  - 1 day
  - 1 week
  - 8 days
  - forever

Push notifications are not implemented on the backend.

## 18. Update Delivery Protocol (Telegram-like)

Two mechanisms:
1. `diff` — catch-up synchronization from a given offset.
2. `stream` — live update stream after synchronization.

Key principles:
- Each user has their own `offset`.
- All updates are persisted on the backend, not in an ephemeral queue.
- No more than 5000 latest updates are stored per user.
- Each update has a sequential `seqno` (per user). Sequential numbering allows the client to detect holes that would require a `diff` to fill.

### 18.1 diff

- On connect/reconnect, the client calls `diff` with its last `offset`.
- Backend returns:
  - list of updates with `seqno > offset`;
  - current `headOffset`.
- If `offset` is too old (beyond the 5000-update retention limit), backend returns a `resetRequired` flag, and the client performs a full re-sync via REST endpoints.

### 18.2 stream

- On connect, the stream returns the current `offset` so the client knows its starting point.
- After `diff`, the client opens a `stream` and receives new updates in real time.
- The stream contains only events with a sequence number.
- On disconnect, the client does `diff` again and then reopens the `stream`.

## 19. Files and Images

Files are stored in S3-compatible storage.
- For each file/image:
  - a content hash (e.g. SHA-256) is stored and returned in the API;
  - a reference list tracks where the file is used.
- On message deletion:
  - file references from that message are removed;
  - if no references remain, the file is deleted (or queued for GC).

### 19.1 Deferred Upload Binding

- On upload, the file is initially considered temporary (`pending`).
- 24 hours are given to attach the file to a message.
- If unused within 24 hours, the file is deleted by a cleanup process.
- File commit is **not a separate API call** — it happens implicitly when a message is sent (with attachments) or when an avatar is uploaded.

### 19.2 Avatars

- User avatars also have a hash returned in the API.
- The hash can be computed by the client or backend.
- Backend automatically generates required sizes (resize) for the client.

## 20. API Style

- Maximally simple REST-style.
- GET/POST only.
- Unified JSON response format.
- All schemas validated through Zod.

Recommended base endpoint groups:
- `POST /auth/email/request-otp`
- `POST /auth/email/verify-otp`
- `GET /me`
- `GET /chats`
- `GET /chats/:chatId/messages` — supports `before`, `after`, `around` params for bidirectional pagination
- `POST /messages/send` — also commits any attached pending files
- `POST /updates/diff`
- `GET /updates/stream` (long-lived SSE endpoint)
- `POST /files/upload-init`
- `POST /users/avatar` — uploads and commits avatar in one call

## 21. Redis Role

Redis is used as an auxiliary realtime/cache layer:
- storing ephemeral connection/presence data;
- online statuses (ping/timeout);
- pub/sub acceleration for live update delivery between backend instances;
- temporary keys for rate limits and OTP throttling;
- typing state persistence with TTL and realtime relay.

The primary DB (via Prisma) remains the source of truth for chat state and updates.

## 22. What Not to Overcomplicate in v1

- No complex queues or brokers for updates.
- No separate materialization of unread counters.
- No calls/voice/push.
- No active AI agent connections (agents are passive definitions).
- Keep the protocol predictable: `diff` + `stream`.
- Keep multi-org simple: one user — one active organization.
- No complex admin controls for organizations.

## 23. Project Conventions

All conventions from `CLAUDE.md` apply. Key points:

- One public function per file, prefix naming (`channelCreate`, `messageSend`).
- Server sources in `packages/daycare-server/sources/`.
- Tests in `*.spec.ts` next to the file under test.
- Central types via `@/types`.
- Angular-style commits.

## 24. References

Existing projects and resources to reference during development:

- **~/Developer/daycare** — Reference for project structure, utilities, inference code, and coding principles. Key patterns:
  - `sources/util/` — reusable utilities (async locks, sync primitives, time helpers, debounce, shutdown hooks)
  - `sources/engine/` — domain-organized code with prefix naming (`agentNormalize.ts`, `permissionApply.ts`)
  - One public function per file, `domainVerb.ts` naming convention
  - Facade pattern for collection management (plural-named classes: `Agents`, `Modules`)
  - Plugin architecture for contained features
  - `CLAUDE.md` / `AGENTS.md` for conventions

- **~/Developer/happy** — Reference for monorepo structure, client code, and Electron/Tauri app patterns. Key patterns:
  - `packages/happy-server/` — Fastify 5 + Prisma + Zod + Redis server (closest to our server architecture)
  - `packages/happy-app/` — React Native + Expo client with real-time sync engine
  - `packages/happy-cli/` — CLI wrapper with daemon mode, socket.io, end-to-end encryption
  - `sources/modules/` for reusable non-domain logic, `sources/apps/` for feature-specific code
  - `inTx` for database transactions, `afterTx` for post-commit event emission
  - `InvalidateSync` / `AsyncLock` for async coordination
  - Idempotent API design

- **~/Developer/privacy-kit** — Import as a library (`privacy-kit`) for token management and cryptographic primitives. Exports:
  - `createPersistentTokenGenerator` / `createPersistentTokenVerifier` — for auth tokens (replaces JWT)
  - `createEphemeralTokenGenerator` / `createEphemeralTokenVerifier` — for short-lived tokens (OTP)
  - `encodeBase64` / `decodeBase64` — always use these instead of `Buffer`
  - `randomBytes`, `crypto` — safe crypto primitives
  - `ExpirableMap`, `monotonicNow` — utility collections and time

- **Telegram API Schema** (https://core.telegram.org/schema) — Reference for API design patterns:
  - Update delivery: sequential `pts`/`seq` numbering for gap detection
  - Message pagination: offset-based with message ID anchors
  - Read state: `read_inbox_max_id` / `read_outbox_max_id` per dialog
  - Typing indicators: `sendMessageTypingAction` broadcast per chat
  - User profiles: `first_name` + optional `last_name`, `username`, `status`
  - Threads: `reply_to` header with `top_msg_id` for thread grouping
