# Daycare Server TODO

## Phase 1: Bootstrap Infrastructure
- [x] Align agent/dev instructions with README architecture (Postgres + Prisma + Redis + Docker).
- [x] Add Docker Compose services for local development infrastructure (`db`, `redis`, `s3`).
- [x] Add server environment template for local development.
- [x] Add Prisma schema for Daycare v1 core entities.
- [x] Generate initial Prisma migration.
- [x] Implement server bootstrap sequence:
  - [x] read/validate env config,
  - [x] connect to PostgreSQL,
  - [x] connect to Redis,
  - [x] start Fastify API.

## Phase 2: Core Utilities (from referenced projects)
- [x] Add logger utility with fixed module labels (`getLogger("module.name")`).
- [x] Add graceful shutdown coordination utility.
- [x] Add async lock utility (`AsyncLock`).
- [x] Add sync helpers (`InvalidateSync`, `ValueSync`).
- [x] Add time/backoff helpers.
- [x] Add debounce helpers.
- [x] Add focused tests for utilities.

## Phase 3: Server Core (v1)
- [x] Implement auth basics (email OTP flow wiring + session token model plumbing).
- [x] Implement organization + profile lifecycle endpoints.
- [x] Implement channels and membership endpoints.
- [x] Implement message send/list/edit/delete with thread support.
- [x] Implement reactions and mention extraction server-side.
- [x] Implement typing persistence + TTL handling (Redis).
- [x] Implement read-state and computed unread counters.
- [x] Implement persisted updates (`diff`) + SSE `stream`.
- [x] Implement attachment lifecycle (`pending` -> `committed`, cleanup job).

## Phase 4: Hardening
- [x] Add integration tests for key API flows.
- [x] Add idempotency guards for write endpoints.
- [x] Add idempotency key retention cleanup job.
- [x] Add startup and health diagnostics.
- [ ] Add dev seed script and developer docs.
