# Diker

AI-focused messenger. Slack-like architecture with first-class AI agent participation.

## Architecture

Monorepo with two packages:

- **daycare-server** — API server. TypeScript, ESM, Fastify.
- **daycare-web** — SPA client. TypeScript, Vite, React.

Communication between client and server uses WebSocket for real-time messaging and REST for CRUD operations.

## Modules

### Auth

Session-based authentication. Users authenticate with email + password. Server issues a session token returned as an opaque bearer token. Sessions are stored server-side with expiration. No OAuth, no JWT — simple session table.

### Users

Every participant in the system is a **User**. Two kinds:

- **human** — a real person with credentials.
- **ai** — an AI agent. Created programmatically. Cannot log in through the auth flow. Operates via internal server APIs.

User record: `id`, `kind` (human | ai), `name`, `avatarUrl`, `createdAt`. AI users have an additional `model` field (e.g. `claude-sonnet-4-5-20250929`).

Presence is not tracked in v1.

### Channels

A channel is a conversation space. Flat list, no threading in v1.

Channel record: `id`, `name`, `createdAt`. Every channel has a membership list. Users must be members to read or write.

Operations: create channel, rename, list channels, join, leave, list members.

### Messages

A message belongs to a channel and is authored by a user (human or ai).

Message record: `id`, `channelId`, `userId`, `text`, `createdAt`. Plain text only in v1 — no attachments, no markdown rendering, no reactions.

New messages are broadcast to all channel members via WebSocket. REST endpoint for history (paginated, cursor-based, newest-first).

### AI

AI users participate in channels like regular users. When a human sends a message that mentions an AI user (`@agent-name`), the server invokes the AI agent. The agent receives the recent channel history as context and responds with a message posted under its own user identity.

AI dispatch is synchronous in v1 — the server calls the inference provider, waits for the response, and posts it. No streaming to clients yet.

## Data Storage

SQLite via `better-sqlite3`. Single file database. Migrations managed with a simple sequential numbering scheme (`001_init.sql`, `002_add_channels.sql`, ...). No ORM — raw SQL queries with typed helper functions.

## API Design

REST endpoints follow the pattern: `POST /api/channels`, `GET /api/channels/:id/messages`.

WebSocket connection established after auth. Server pushes events:

- `message.created` — new message in a channel the user is a member of.
- `channel.created` — a new channel was created.
- `member.joined` / `member.left` — membership changes.

Client sends commands over WebSocket:

- `message.send` — post a message to a channel.

## Project Conventions

All conventions from `CLAUDE.md` apply. Key points:

- One public function per file, prefix naming (`channelCreate`, `messageSend`).
- Sources in `packages/daycare-server/sources/`.
- Tests in `*.spec.ts` next to the file under test.
- Central types via `@/types`.
- Angular-style commits.
