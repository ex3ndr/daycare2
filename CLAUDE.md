# Daycare — agent notes

## Goals
- AI-focused messenger (Slack-like)
- humans and AI agents coexist as first-class participants in channels
- keep the core minimal; ship v1 with threads, attachments, reactions, persisted typing, and computed unread counters

## Architecture
- monorepo: `packages/daycare-server` (Fastify API + SSE), `packages/daycare-web` (Vite + React SPA)
- server owns all state; client is a thin UI that subscribes to events
- PostgreSQL + Prisma ORM for persistent state
- Redis for ephemeral realtime/cache state
- Docker Compose for local infrastructure (api, db, redis, s3)
- REST for CRUD, SSE for real-time events

## Conventions
- typescript only, esm output
- sources live in `sources/` (server), `app/` (web)
- tests use `*.spec.ts`, live next to the file under test
- do not use barrel `index.ts` files

## Build, Test, and Development Commands
- Runtime baseline: Node **22+**.
- Install deps: `yarn install`
- Run server in dev: `yarn dev`
- Run web in dev: `yarn web`
- Type-check: `yarn typecheck` (tsc)
- Tests: `yarn test` (vitest)

## Integration OTP (Static Code)
- Purpose: allow integration testing on live-like environments without bypassing OTP for all users.
- Enable with env flag: `OTP_STATIC_ENABLED=true`
- Static identity:
  - email from `OTP_STATIC_EMAIL` (default `integration-test@daycare.local`)
  - code from `OTP_STATIC_CODE` (default `424242`, six digits)
- Behavior: only `POST /api/auth/email/verify-otp` for this exact email+code pair bypasses Redis OTP state; all other emails/codes still use normal OTP verification.

## Coding Style
- Language: TypeScript (ESM). Prefer strict typing; avoid `any`.
- Brief comments for tricky or non-obvious logic only.
- Keep files under ~700 LOC; split when it improves clarity.
- Naming: use **Daycare** for product/UI/docs headings; use `daycare` in user-facing strings and config keys.
- Use `@/types` for shared types instead of deep module imports.

## File Organization: One Function, Prefix Naming
- One public function per file. File name matches function name.
- Prefix notation: `channelCreate` not `createChannel`, `messageSend` not `sendMessage`.
- `domainVerb.ts` + `domainVerb.spec.ts` side by side.
- Underscore prefix (`_routes.ts`, `_migrations.ts`) for aggregation/registry files.
- Group files into domain folders: `channels/`, `messages/`, `users/`, `auth/`, `ai/`.

## Database
- PostgreSQL via Prisma ORM.
- Schema: `packages/daycare-server/prisma/schema.prisma`.
- Migrations: `packages/daycare-server/prisma/migrations/*` (Prisma Migrate).
- Prefer Prisma models/queries and typed data access helpers.
- All IDs are strings (cuid2).
- DB timestamps are Prisma `DateTime`; use unix milliseconds at API boundaries.

## API & SSE
- REST: `POST /api/auth/login`, `GET /api/channels`, `GET /api/channels/:id/messages`, etc.
- SSE events from server: `message.created`, `channel.created`, `member.joined`, `member.left`.
- Client commands are REST calls (for example `POST /api/messages/send`), not socket commands.
- Auth: session-based bearer token in `Authorization` header for REST and SSE requests.

### Added v1 routes
- Direct messages: `POST /api/org/:orgid/directs`, `GET /api/org/:orgid/directs`
- Files: `GET /api/org/:orgid/files/:fileId`
- Presence: `POST /api/org/:orgid/presence`, `POST /api/org/:orgid/presence/heartbeat`, `GET /api/org/:orgid/presence`
- Member management: `POST /api/org/:orgid/channels/:channelId/members/:userId/kick`, `PATCH /api/org/:orgid/channels/:channelId/members/:userId/role`
- Archiving: `POST /api/org/:orgid/channels/:channelId/archive`, `POST /api/org/:orgid/channels/:channelId/unarchive`
- Notifications: `PATCH /api/org/:orgid/channels/:channelId/notifications`
- Search: `GET /api/org/:orgid/search/messages`, `GET /api/org/:orgid/search/channels`
- AI bots: `POST /api/org/:orgid/bots`, `GET /api/org/:orgid/bots`, `PATCH /api/org/:orgid/bots/:userId`

### Added/used SSE event types
- `message.created`
- `channel.created`
- `channel.updated`
- `member.joined`
- `member.left`
- `member.updated`
- `user.presence`
- `user.typing`

## Environment
- Core:
  - `DATABASE_URL`
  - `REDIS_URL`
- S3 / MinIO:
  - `S3_ENDPOINT`
  - `S3_ACCESS_KEY`
  - `S3_SECRET_KEY`
  - `S3_BUCKET`
  - `S3_FORCE_PATH_STYLE`
- OTP:
  - `OTP_TTL_SECONDS`
  - `OTP_COOLDOWN_SECONDS`
  - `OTP_MAX_ATTEMPTS`
  - `OTP_SALT`
  - `OTP_STATIC_ENABLED`
  - `OTP_STATIC_EMAIL`
  - `OTP_STATIC_CODE`

## Central Types (`@/types`)
- Cross-cutting types (User, Channel, Message, Session) go in `sources/types.ts`.
- Domain-internal types stay in their local modules.

## Time Handling
- Unix timestamps (milliseconds) everywhere. `Date` only at boundaries for parsing/formatting.

## Logging
- `getLogger("module.name")` — always pass an explicit module name.
- Module labels padded/trimmed to 20 chars.

## Public API Server (Web Development)
When working on the web app (`packages/daycare-web`), use the public API server instead of starting local infrastructure:
- **API endpoint**: `https://daycare-api.korshakov.org/`
- **No local infra needed**: skip `yarn infra:up` and `yarn dev` — the public server is always available.
- **Vite proxy target**: set to `https://daycare-api.korshakov.org` in `packages/daycare-web/vite.config.ts`.
- **Auth**: use integration OTP — email `integration-test@daycare.local`, code `424242`.
- **Workflow**: `yarn web` → open `http://localhost:7332` → Vite proxies `/api` to the public server.

## Agent-Specific Notes
- **Always write code, comments, commit messages, and documentation in English.**
- Never edit `node_modules`.
- When answering questions, verify in code; do not guess.
- Patching dependencies requires explicit approval.
- **Multi-agent safety:** do not create/apply/drop `git stash` unless explicitly requested.
- **Multi-agent safety:** do not switch branches unless explicitly requested.
- **Multi-agent safety:** when you see unrecognized files, keep going; commit only your changes.
- keep configs small and explicit
- avoid hidden side effects
- commit after each ready-to-use change using Angular-style commits
- build and run tests before each commit
- avoid backward-compatibility shims for internal code
