# Daycare — agent notes

## Goals
- AI-focused messenger (Slack-like)
- humans and AI agents coexist as first-class participants in channels
- keep the core minimal; ship v1 with text-only messaging, no threading

## Architecture
- monorepo: `packages/daycare-server` (Fastify API + WebSocket), `packages/daycare-web` (Vite + React SPA)
- server owns all state; client is a thin UI that subscribes to events
- SQLite (`better-sqlite3`) for persistence, raw SQL, sequential migrations
- REST for CRUD, WebSocket for real-time events

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
- SQLite via `better-sqlite3`. Single file. No ORM.
- Migrations: `sources/db/migrations/001_init.sql`, `002_...sql`, etc.
- Typed query helpers — one function per query, return plain objects.
- All IDs are strings (cuid2).
- Timestamps are unix milliseconds stored as integers.

## API & WebSocket
- REST: `POST /api/auth/login`, `GET /api/channels`, `GET /api/channels/:id/messages`, etc.
- WebSocket events from server: `message.created`, `channel.created`, `member.joined`, `member.left`.
- WebSocket commands from client: `message.send`.
- Auth: session-based, bearer token in `Authorization` header (REST) and as query param on WS connect.

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
