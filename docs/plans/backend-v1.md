# Backend V1 Feature Completion

## Overview
Complete all remaining backend features to reach a production-ready v1 of the Daycare messaging server. The core messaging system (channels, messages, threads, reactions, mentions, typing, read state, SSE) is already built. This plan fills every identified gap: direct messages, S3 file storage, PostgreSQL full-text search, user presence, channel member management, notification preferences, channel archiving, basic AI bot support, and Redis pub/sub for multi-instance SSE scaling.

**What exists today:**
- Auth (OTP email, sessions, tokens), Organizations (multi-tenant)
- Channels (CRUD, join/leave, list), Messages (send/edit/delete, pagination)
- Reactions, mentions, threads, typing indicators, read state
- File uploads (two-phase init + commit, but no S3 wiring)
- SSE event stream with diff sync (in-memory only)
- Idempotency, comprehensive test suite (45 test files)

**What this plan adds:**
- Direct message creation and listing
- S3 (MinIO) file storage and download serving
- PostgreSQL full-text search for messages and channels
- User presence (online/away/offline) via Redis
- Channel member management (kick, role changes)
- Notification preference enforcement in update delivery
- Channel archiving/unarchiving
- Basic AI bot support (create AI users, webhook delivery)
- Redis pub/sub for horizontal SSE scaling
- Rate limiting on key endpoints

## Context (from discovery)
- **Codebase:** `packages/daycare-server/sources/` — 67 implementation files, 45 test files
- **Schema:** 15 Prisma models, 3 migrations applied
- **Routes:** ~35 REST endpoints + 1 SSE endpoint
- **Patterns:** one-function-per-file, `domainVerb.ts` naming, Zod validation, `getLogger()` logging
- **Infra:** PostgreSQL 16, Redis 7, MinIO (S3), Docker Compose

## Development Approach
- **Testing approach**: Regular (code first, then tests)
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: every task MUST include new/updated tests** for code changes in that task
  - tests are not optional — they are a required part of the checklist
  - write unit tests for new functions/methods
  - write unit tests for modified functions/methods
  - add new test cases for new code paths
  - update existing test cases if behavior changes
  - tests cover both success and error scenarios
- **CRITICAL: all tests must pass before starting next task** — no exceptions
- **CRITICAL: update this plan file when scope changes during implementation**
- Run tests after each change
- Maintain backward compatibility with existing API contracts

## Testing Strategy
- **Unit tests**: required for every task (see Development Approach above)
- Pattern: `domainVerb.spec.ts` next to `domainVerb.ts`
- Route tests: use Fastify inject for HTTP-level testing
- Mock external dependencies (Redis, S3) in unit tests
- Integration test coverage for cross-cutting flows

## Progress Tracking
- Mark completed items with `[x]` immediately when done
- Add newly discovered tasks with ➕ prefix
- Document issues/blockers with ⚠️ prefix
- Update plan if implementation deviates from original scope
- Keep plan in sync with actual work done

---

## Implementation Steps

### Task 1: Direct message creation and listing

DM support already has schema backing (`Chat` with `kind: DIRECT`, `directKey` field) but no API routes.

- [x] Create `sources/apps/channels/directCreate.ts` — find-or-create a DM chat between two users using `directKey` (sorted user ID pair), add both as members, emit `channel.created` update to both users
- [x] Create `sources/apps/channels/directList.ts` — list all DM chats for the current user (joined ChatMembers where `kind=DIRECT` and `leftAt` is null), include the other user's profile info
- [x] Add routes in `sources/apps/api/routes/channelRoutesRegister.ts`:
  - `POST /api/org/:orgid/directs` — create/open DM (body: `{ userId: string }`)
  - `GET /api/org/:orgid/directs` — list user's DMs
- [x] Ensure existing message routes work for DM chats (messages are already chat-agnostic, verify thread/reaction/typing/read work for DM chats)
- [x] Write tests for `directCreate` (success, idempotent re-creation, self-DM rejection)
- [x] Write tests for `directList` (empty list, multiple DMs, excludes left DMs)
- [x] Write route-level tests for both DM endpoints
- [x] Run tests — must pass before next task

### Task 2: S3 file storage integration

MinIO is running in Docker Compose but file uploads currently store base64 in the response. Wire actual S3 storage.

- [x] Create `sources/modules/s3/s3ClientCreate.ts` — initialize S3 client using `@aws-sdk/client-s3` (or `minio` package if already available), configured via environment variables (`S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`)
- [x] Create `sources/modules/s3/s3ObjectPut.ts` — upload a Buffer to S3 with key and content type
- [x] Create `sources/modules/s3/s3ObjectGet.ts` — generate a presigned URL or stream object from S3
- [x] Update `sources/apps/files/fileUploadCommit.ts` — decode base64, upload to S3 using `storageKey`, update `FileAsset` status to COMMITTED
- [x] Add file download route: `GET /api/org/:orgid/files/:fileId` — look up FileAsset, stream from S3 or redirect to presigned URL
- [x] Add S3 config to `sources/modules/config/configRead.ts`
- [x] Update `docker-compose.yml` environment section if needed for S3 credentials
- [x] Write tests for `s3ObjectPut` and `s3ObjectGet` (mock S3 client)
- [x] Write tests for updated `fileUploadCommit` (verify S3 upload called)
- [x] Write tests for file download route (success, not found, unauthorized)
- [x] Run tests — must pass before next task

### Task 3: File cleanup service for S3

The existing cleanup service needs to actually delete from S3.

- [x] Create `sources/modules/s3/s3ObjectDelete.ts` — delete object from S3 by key
- [x] Update `sources/modules/files/fileCleanupStart.ts` — for expired PENDING files and DELETED files, delete from S3 before removing DB records
- [x] Write tests for `s3ObjectDelete` (mock S3 client)
- [x] Write tests for updated cleanup (verify S3 delete called for each file)
- [x] Run tests — must pass before next task

### Task 4: User presence system

Track online/away/offline status using Redis with TTL-based expiration.

- [x] Create `sources/apps/users/presenceSet.ts` — set user's presence in Redis (`presence:{orgId}:{userId}` → `online|away`, TTL 90 seconds), publish presence change event
- [x] Create `sources/apps/users/presenceGet.ts` — get presence for a list of user IDs from Redis, return `online|away|offline` (missing key = offline)
- [x] Create `sources/apps/users/presenceHeartbeat.ts` — refresh TTL on existing presence key (called periodically by client)
- [x] Add routes:
  - `POST /api/org/:orgid/presence` — set presence status (body: `{ status: "online" | "away" }`)
  - `POST /api/org/:orgid/presence/heartbeat` — refresh presence TTL
  - `GET /api/org/:orgid/presence` — get presence for multiple users (query: `userIds=id1,id2,...`)
- [x] Add SSE event type `user.presence` — broadcast to org members when presence changes
- [x] Update `User` lastSeenAt — set on presence heartbeat
- [x] Write tests for `presenceSet` (set online, set away, TTL verification)
- [x] Write tests for `presenceGet` (online user, offline user, mixed list)
- [x] Write route-level tests for presence endpoints
- [x] Run tests — must pass before next task

### Task 5: Channel member management

Add ability to kick members and change roles. Currently only join/leave exist.

- [ ] Create `sources/apps/channels/channelMemberKick.ts` — owner/admin removes a member (set `leftAt`), emit `member.left` update, prevent kicking self or other owners
- [ ] Create `sources/apps/channels/channelMemberRoleSet.ts` — owner changes a member's role (OWNER/MEMBER), emit `member.updated` update
- [ ] Add new SSE event type `member.updated` in updates service
- [ ] Add routes:
  - `POST /api/org/:orgid/channels/:channelId/members/:userId/kick` — kick member (requires OWNER role)
  - `PATCH /api/org/:orgid/channels/:channelId/members/:userId/role` — change role (body: `{ role: "OWNER" | "MEMBER" }`, requires OWNER)
- [ ] Write tests for `channelMemberKick` (success, not owner, self-kick rejected, already left)
- [ ] Write tests for `channelMemberRoleSet` (promote to owner, demote, not authorized)
- [ ] Write route-level tests for both endpoints
- [ ] Run tests — must pass before next task

### Task 6: Channel archiving

The `archivedAt` field exists on Chat but has no endpoints.

- [ ] Create `sources/apps/channels/channelArchive.ts` — set `archivedAt` timestamp (owner only), emit `channel.updated` event, prevent sending messages to archived channels
- [ ] Create `sources/apps/channels/channelUnarchive.ts` — clear `archivedAt` (owner only), emit `channel.updated` event
- [ ] Add new SSE event type `channel.updated` in updates service
- [ ] Add routes:
  - `POST /api/org/:orgid/channels/:channelId/archive` — archive channel (requires OWNER)
  - `POST /api/org/:orgid/channels/:channelId/unarchive` — unarchive channel (requires OWNER)
- [ ] Add guard in `messageSend.ts` — reject messages to archived channels with 403
- [ ] Write tests for `channelArchive` (success, not owner, already archived)
- [ ] Write tests for `channelUnarchive` (success, not archived)
- [ ] Write test for message send rejection on archived channel
- [ ] Write route-level tests
- [ ] Run tests — must pass before next task

### Task 7: Notification preference enforcement

`notificationLevel` (ALL/MENTIONS_ONLY/MUTED) exists on ChatMember but isn't enforced during update delivery.

- [ ] Create `sources/apps/channels/channelNotificationSet.ts` — update ChatMember `notificationLevel`, `muteForever`, `muteUntil` fields
- [ ] Add route: `PATCH /api/org/:orgid/channels/:channelId/notifications` — update notification preferences (body: `{ level: "ALL" | "MENTIONS_ONLY" | "MUTED", muteUntil?: number }`)
- [ ] Update update delivery logic in `updatesServiceCreate.ts` — when broadcasting `message.created`, check recipient's notification level:
  - `ALL` → always deliver
  - `MENTIONS_ONLY` → deliver only if user is mentioned in message
  - `MUTED` → skip delivery (unless `muteUntil` has passed)
- [ ] Write tests for `channelNotificationSet` (set each level, set muteUntil, clear mute)
- [ ] Write tests for filtered update delivery (muted user doesn't receive, mentions-only receives when mentioned)
- [ ] Write route-level tests
- [ ] Run tests — must pass before next task

### Task 8: PostgreSQL full-text search

Add search for messages and channels using Postgres tsvector.

- [ ] Create Prisma migration adding:
  - `search_vector tsvector` column on `Message` table (generated from `text`)
  - GIN index on `Message.search_vector`
  - Trigger to auto-update `search_vector` on INSERT/UPDATE of `text`
  - GIN index on `Chat.name` for channel name search (using `to_tsvector`)
- [ ] Create `sources/apps/messages/messageSearch.ts` — full-text search on messages within an org, with optional `channelId` filter, pagination (limit/offset), returns messages with highlights (`ts_headline`)
- [ ] Create `sources/apps/channels/channelSearch.ts` — search channels by name/topic within an org
- [ ] Add routes:
  - `GET /api/org/:orgid/search/messages` — search messages (query: `q`, `channelId?`, `before?`, `limit?`)
  - `GET /api/org/:orgid/search/channels` — search channels (query: `q`, `limit?`)
- [ ] Write tests for `messageSearch` (basic search, channel filter, pagination, no results, special characters)
- [ ] Write tests for `channelSearch` (name match, topic match, no results)
- [ ] Write route-level tests for both search endpoints
- [ ] Run tests — must pass before next task

### Task 9: Basic AI bot support

AI users already exist in the schema (`User.kind = AI`). Add API support for creating and managing them, plus webhook delivery.

- [ ] Create `sources/apps/ai/aiBotCreate.ts` — create an AI user in an org with `kind: AI`, `systemPrompt`, and a `webhookUrl` (store in user metadata or new field)
- [ ] Create Prisma migration to add `webhookUrl` field to User model (nullable, only used for AI users)
- [ ] Create `sources/apps/ai/aiBotWebhookDeliver.ts` — when an AI user is mentioned in a message or receives a DM, POST the message payload to the bot's `webhookUrl` (fire-and-forget with retry)
- [ ] Create `sources/apps/ai/aiBotList.ts` — list AI users in an org
- [ ] Add routes:
  - `POST /api/org/:orgid/bots` — create AI bot (body: `{ username, firstName, systemPrompt, webhookUrl, avatarUrl? }`)
  - `GET /api/org/:orgid/bots` — list AI bots in org
  - `PATCH /api/org/:orgid/bots/:userId` — update bot config
- [ ] Hook webhook delivery into `messageSend.ts` — after saving message, if any mentioned user or DM recipient is an AI bot with a webhookUrl, call `aiBotWebhookDeliver`
- [ ] Write tests for `aiBotCreate` (success, duplicate username, missing fields)
- [ ] Write tests for `aiBotWebhookDeliver` (successful delivery, webhook failure handling, retry logic)
- [ ] Write tests for bot list endpoint
- [ ] Write integration test: send message mentioning bot → webhook called
- [ ] Run tests — must pass before next task

### Task 10: Redis pub/sub for SSE scaling

Current SSE uses in-memory subscriptions, limiting to single instance. Add Redis pub/sub layer.

- [ ] Create `sources/modules/redis/redisPubSubCreate.ts` — create separate Redis connections for pub and sub (ioredis requires dedicated connections for subscribers)
- [ ] Create `sources/modules/updates/updatesBroadcast.ts` — publish updates to Redis channel `updates:{userId}` instead of (or in addition to) in-memory map
- [ ] Update `sources/modules/updates/updatesServiceCreate.ts`:
  - On client subscribe: subscribe to Redis channel `updates:{userId}`
  - On Redis message: forward to local SSE connections for that user
  - On client disconnect: unsubscribe from Redis channel if no more local connections
  - Keep DB persistence (UserUpdate table) unchanged
- [ ] Ensure graceful shutdown: unsubscribe all Redis channels on server shutdown
- [ ] Write tests for `redisPubSubCreate` (connect, disconnect, error handling)
- [ ] Write tests for `updatesBroadcast` (publish to Redis, verify subscribers receive)
- [ ] Write tests for updated SSE service (multi-instance simulation: publish from one, receive on another)
- [ ] Run tests — must pass before next task

### Task 11: Rate limiting

Add rate limiting on key endpoints to prevent abuse.

- [ ] Create `sources/modules/rateLimit/rateLimitCheck.ts` — Redis-based sliding window rate limiter (`ratelimit:{scope}:{key}` with TTL)
- [ ] Create `sources/apps/api/lib/rateLimitMiddleware.ts` — Fastify preHandler hook that calls `rateLimitCheck`, returns 429 with `Retry-After` header on limit exceeded
- [ ] Apply rate limits to key endpoints:
  - Auth OTP request: 5/min per email
  - Message send: 30/min per user
  - File upload: 10/min per user
  - Search: 20/min per user
  - Typing: 10/min per user per channel
- [ ] Write tests for `rateLimitCheck` (under limit, at limit, over limit, window expiry)
- [ ] Write tests for middleware (429 response, Retry-After header, pass-through when under limit)
- [ ] Run tests — must pass before next task

### Task 12: Verify acceptance criteria

- [ ] Verify all 11 feature tasks are implemented and marked complete
- [ ] Verify DMs: create, list, send messages, receive SSE updates
- [ ] Verify files: upload to S3, download/serve, cleanup deletes from S3
- [ ] Verify search: message search with filters, channel search
- [ ] Verify presence: set/get/heartbeat, SSE presence events
- [ ] Verify member management: kick, role changes, authorization checks
- [ ] Verify archiving: archive/unarchive, message send blocked on archived
- [ ] Verify notifications: muted users don't receive, mentions-only works
- [ ] Verify AI bots: create, list, webhook delivery on mention/DM
- [ ] Verify SSE scaling: Redis pub/sub works across simulated instances
- [ ] Verify rate limiting: 429 responses with correct headers
- [ ] Run full test suite — all tests must pass
- [ ] Run `yarn typecheck` — no type errors
- [ ] Run linter if configured — all clean

### Task 13: [Final] Update documentation

- [ ] Update CLAUDE.md with new API endpoints and event types
- [ ] Add environment variable documentation for S3 and new config
- [ ] Update `sources/types.ts` with any new shared types added during implementation

## Technical Details

### Direct Messages
- `directKey` = sorted concatenation of two user IDs (e.g., `userId1:userId2`) ensuring uniqueness
- DM chats use `kind: DIRECT`, `visibility: PRIVATE`
- Re-opening a DM returns the existing chat (idempotent via `directKey` unique constraint)

### S3 Storage
- Bucket: configurable via `S3_BUCKET` env var (default: `daycare-uploads`)
- Storage keys: `{orgId}/{fileId}/{fileName}` format (already generated by `fileUploadInit`)
- Presigned URLs for downloads (1 hour expiry) or direct streaming for smaller files

### Full-Text Search
- Language: `english` (Postgres text search configuration)
- Search vector: weighted — message text gets weight A
- Results ranked by `ts_rank_cd` for relevance
- Channel search uses `to_tsvector(name || ' ' || coalesce(topic, ''))`

### Presence
- Redis keys: `presence:{orgId}:{userId}` → `"online"` or `"away"`
- TTL: 90 seconds (client sends heartbeat every 60 seconds)
- Presence change events broadcast to all online org members

### Rate Limiting
- Algorithm: sliding window counter using Redis sorted sets
- Key pattern: `ratelimit:{endpoint}:{userId}` with score = timestamp
- ZREMRANGEBYSCORE to expire old entries, ZCARD to count

### Redis Pub/Sub for SSE
- Channel pattern: `updates:{userId}`
- Each server instance subscribes to channels for its connected users
- Updates are still persisted to DB first, then published to Redis
- On reconnect, clients use diff endpoint to catch up (existing behavior)

### AI Bot Webhooks
- POST to `webhookUrl` with JSON body: `{ event: "message.created", message: Message, channel: Channel, mentionedBot: User }`
- Timeout: 10 seconds
- Retry: 1 retry after 5 seconds on failure
- No signature verification in v1 (future enhancement)

## Post-Completion

**Manual verification:**
- Test DM flow end-to-end with web client
- Test file upload/download through the UI
- Verify search results relevance and performance with realistic data
- Test presence with multiple browser tabs
- Load test SSE with Redis pub/sub across 2+ server instances
- Verify MinIO console shows uploaded files at localhost:9001

**Future enhancements (not in scope):**
- Webhook signature verification for AI bots
- Built-in LLM orchestration for AI agents
- Message edit/delete search index updates
- Elasticsearch migration for large-scale search
- Push notifications (mobile/desktop)
- User blocking/muting
- Channel categories/folders
- Message pinning and bookmarks
- Audit logging
