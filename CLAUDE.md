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

## Central Types (`@/types`)
- Cross-cutting types (User, Channel, Message, Session) go in `sources/types.ts`.
- Domain-internal types stay in their local modules.

## Time Handling
- Unix timestamps (milliseconds) everywhere. `Date` only at boundaries for parsing/formatting.

## Logging
- `getLogger("module.name")` — always pass an explicit module name.
- Module labels padded/trimmed to 20 chars.

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
