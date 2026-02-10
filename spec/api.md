# Daycare API Schema (v1)

This file defines the complete Daycare v1 API contract.

Scope:
- Multi-organization onboarding and membership
- Profile lifecycle (create + update first name, last name, username)
- Threaded channel messaging
- File attachments
- Reactions
- Persisted typing indicators
- Persisted read state with unread counters computed on read
- REST for commands/CRUD + SSE for realtime delivery

## 1. Conventions

### 1.1 Base Paths
- API base: `/api`
- Organization-scoped base: `/api/org/:orgid`
- SSE stream (org-scoped): `/api/org/:orgid/updates/stream`

### 1.2 Routing Rule
- Account/global endpoints stay under `/api/...`.
- All organization-scoped endpoints are prefixed with `/api/org/:orgid/...`.
- `orgid` in path is the source of org context (no active-org switching endpoint).

### 1.3 Data Rules
- IDs are strings (`cuid2`).
- Timestamps are unix milliseconds (`number`).
- JSON for REST request/response bodies.
- `Content-Type: application/json` for REST writes.

### 1.4 Authentication
- REST: `Authorization: Bearer <token>`
- SSE: `Authorization: Bearer <token>`
- Session token is opaque.

### 1.5 Response Envelope

Success:

```json
{
  "ok": true,
  "data": {}
}
```

Failure:

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Username is already taken",
    "details": {
      "field": "username"
    }
  }
}
```

## 2. Shared Types

```ts
type Id = string;
type UnixMs = number;
type Cursor = string;

type UserKind = "human" | "ai";
type OrganizationRole = "owner" | "admin" | "member";
type ChannelVisibility = "public" | "private";
type ChannelMemberRole = "owner" | "member";
type AttachmentKind = "image" | "document" | "audio";

type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

type ApiError = {
  code: ApiErrorCode;
  message: string;
  details?: Record<string, unknown>;
};

type ApiSuccess<T> = {
  ok: true;
  data: T;
};

type ApiFailure = {
  ok: false;
  error: ApiError;
};

type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
```

## 3. Domain Models

```ts
type Account = {
  id: Id;
  email: string;
  createdAt: UnixMs;
  updatedAt: UnixMs;
};

type Session = {
  token: string;
  accountId: Id;
  createdAt: UnixMs;
  expiresAt: UnixMs | null;
};

type Organization = {
  id: Id;
  slug: string;
  name: string;
  avatarUrl: string | null;
  createdBy: Id; // account id
  createdAt: UnixMs;
  updatedAt: UnixMs;
};

type OrganizationMembership = {
  organizationId: Id;
  userId: Id;
  role: OrganizationRole;
  joinedAt: UnixMs;
};

type User = {
  id: Id;
  organizationId: Id;
  accountId: Id;
  kind: UserKind;
  username: string;
  firstName: string;
  lastName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  timezone: string;
  systemPrompt: string | null;
  createdAt: UnixMs;
  updatedAt: UnixMs;
};

type Channel = {
  id: Id;
  organizationId: Id;
  name: string;
  slug: string;
  visibility: ChannelVisibility;
  topic: string | null;
  createdBy: Id;
  createdAt: UnixMs;
  updatedAt: UnixMs;
};

type ChannelMember = {
  channelId: Id;
  userId: Id;
  role: ChannelMemberRole;
  joinedAt: UnixMs;
};

type FileAttachment = {
  id: Id;
  organizationId: Id;
  kind: AttachmentKind;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  hashSha256: string;
  storageKey: string;
  createdBy: Id;
  createdAt: UnixMs;
};

type MessageReaction = {
  shortcode: string;
  userIds: Id[];
  count: number;
  updatedAt: UnixMs;
};

type Message = {
  id: Id;
  organizationId: Id;
  channelId: Id;
  authorId: Id;
  text: string;
  mentionUserIds: Id[];
  threadRootMessageId: Id | null;
  threadReplyCount: number;
  threadLastReplyAt: UnixMs | null;
  attachments: FileAttachment[];
  reactions: MessageReaction[];
  createdAt: UnixMs;
  updatedAt: UnixMs;
  deletedAt: UnixMs | null;
};

type MessageView = {
  message: Message;
  author: Pick<User, "id" | "kind" | "username" | "firstName" | "lastName" | "avatarUrl">;
};

type TypingIndicator = {
  organizationId: Id;
  channelId: Id;
  userId: Id;
  threadRootMessageId: Id | null;
  startedAt: UnixMs;
  expiresAt: UnixMs;
  updatedAt: UnixMs;
};

type ChannelReadState = {
  organizationId: Id;
  channelId: Id;
  userId: Id;
  lastReadAtMs: UnixMs;
  lastReadMessageId: Id | null;
  unreadCount: number; // computed, not incrementally persisted
  updatedAt: UnixMs;
};
```

## 4. Pagination Types

```ts
type MessageListPage = {
  items: MessageView[];
  page: {
    limit: number;
    nextCursor: Cursor | null;
    prevCursor: Cursor | null;
    hasMoreOlder: boolean;
    hasMoreNewer: boolean;
  };
};

type ChannelListPage = {
  items: Channel[];
  nextCursor: Cursor | null;
};
```

## 5. REST API

## 5.1 Auth (Account Scope)

### `POST /api/auth/email/request-otp`

Request:

```ts
type AuthEmailRequestOtpRequest = {
  email: string;
};
```

Response:

```ts
type AuthEmailRequestOtpResponse = {
  sent: true;
  retryAfterMs: number;
};
```

### `POST /api/auth/email/verify-otp`

Request:

```ts
type AuthEmailVerifyOtpRequest = {
  email: string;
  otp: string;
};
```

Response:

```ts
type AuthEmailVerifyOtpResponse = {
  session: Session;
  account: Account;
  onboarding: {
    needsOrganization: boolean;
    needsProfile: boolean;
  };
};
```

### `POST /api/auth/logout`

Request:

```ts
type AuthLogoutRequest = {};
```

Response:

```ts
type AuthLogoutResponse = {
  loggedOut: true;
};
```

## 5.2 Account + Organization Discovery (Account Scope)

### `GET /api/me`

Response:

```ts
type MeGetResponse = {
  session: Session;
  account: Account;
};
```

### `GET /api/org/available`
Lists organizations available to the authenticated account.

Query:

```ts
type OrganizationAvailableQuery = {
  limit?: number;
  cursor?: Cursor;
};
```

Response:

```ts
type OrganizationAvailableResponse = {
  items: Array<{
    organization: Organization;
    membership: OrganizationMembership | null;
    user: User | null;
  }>;
  nextCursor: Cursor | null;
};
```

### `POST /api/org/create`
Creates a new organization and joins caller as owner.

Request:

```ts
type OrganizationCreateRequest = {
  name: string;
  slug?: string;
};
```

Response:

```ts
type OrganizationCreateResponse = {
  organization: Organization;
  user: User;
  membership: OrganizationMembership;
};
```

### `POST /api/org/:orgid/join`
Joins an organization and creates profile if missing.

Request:

```ts
type OrganizationJoinRequest = {
  firstName?: string;
  lastName?: string;
  username?: string;
};
```

Response:

```ts
type OrganizationJoinResponse = {
  organization: Organization;
  user: User;
  membership: OrganizationMembership;
  createdProfile: boolean;
};
```

### `POST /api/org/:orgid/leave`

Request:

```ts
type OrganizationLeaveRequest = {};
```

Response:

```ts
type OrganizationLeaveResponse = {
  organizationId: Id;
  userId: Id;
  leftAt: UnixMs;
};
```

## 5.3 Organization Metadata (Org Scope)

### `GET /api/org/:orgid`

Response:

```ts
type OrgScopedGetResponse = {
  organization: Organization;
};
```

### `PATCH /api/org/:orgid`

Request:

```ts
type OrganizationPatchRequest = {
  name?: string;
  slug?: string;
  avatarUrl?: string | null;
};
```

Response:

```ts
type OrganizationPatchResponse = {
  organization: Organization;
};
```

### `GET /api/org/:orgid/members`

Response:

```ts
type OrganizationMemberListResponse = {
  items: Array<{
    membership: OrganizationMembership;
    user: Pick<User, "id" | "kind" | "username" | "firstName" | "lastName" | "avatarUrl">;
  }>;
};
```

## 5.4 Profile Lifecycle (Org Scope)

### `POST /api/org/:orgid/profile/create`
Creates profile in org from path.

Request:

```ts
type ProfileCreateRequest = {
  firstName: string;
  lastName?: string;
  username: string;
  timezone: string;
  bio?: string;
};
```

Response:

```ts
type ProfileCreateResponse = {
  user: User;
};
```

### `GET /api/org/:orgid/profile`

Response:

```ts
type ProfileGetResponse = {
  user: User;
};
```

### `PATCH /api/org/:orgid/profile`

Request:

```ts
type ProfilePatchRequest = {
  firstName?: string;
  lastName?: string | null;
  username?: string;
  timezone?: string;
  bio?: string | null;
  avatarUrl?: string | null;
};
```

Response:

```ts
type ProfilePatchResponse = {
  user: User;
};
```

### `POST /api/org/:orgid/profile/first-name`

Request:

```ts
type ProfileFirstNameUpdateRequest = {
  firstName: string;
};
```

Response:

```ts
type ProfileFirstNameUpdateResponse = {
  user: User;
};
```

### `POST /api/org/:orgid/profile/last-name`

Request:

```ts
type ProfileLastNameUpdateRequest = {
  lastName: string | null;
};
```

Response:

```ts
type ProfileLastNameUpdateResponse = {
  user: User;
};
```

### `POST /api/org/:orgid/profile/username`

Request:

```ts
type ProfileUsernameUpdateRequest = {
  username: string;
};
```

Response:

```ts
type ProfileUsernameUpdateResponse = {
  user: User;
};
```

## 5.5 Channels (Org Scope)

### `GET /api/org/:orgid/channels`

Query:

```ts
type ChannelListQuery = {
  search?: string;
  visibility?: ChannelVisibility;
  limit?: number;
  cursor?: Cursor;
};
```

Response:

```ts
type ChannelListResponse = ChannelListPage;
```

### `POST /api/org/:orgid/channels`

Request:

```ts
type ChannelCreateRequest = {
  name: string;
  slug?: string;
  visibility?: ChannelVisibility;
  topic?: string;
};
```

Response:

```ts
type ChannelCreateResponse = {
  channel: Channel;
};
```

### `PATCH /api/org/:orgid/channels/:channelId`

Request:

```ts
type ChannelPatchRequest = {
  name?: string;
  slug?: string;
  topic?: string | null;
  visibility?: ChannelVisibility;
};
```

Response:

```ts
type ChannelPatchResponse = {
  channel: Channel;
};
```

### `POST /api/org/:orgid/channels/:channelId/join`

Request:

```ts
type ChannelJoinRequest = {};
```

Response:

```ts
type ChannelJoinResponse = {
  member: ChannelMember;
};
```

### `POST /api/org/:orgid/channels/:channelId/leave`

Request:

```ts
type ChannelLeaveRequest = {};
```

Response:

```ts
type ChannelLeaveResponse = {
  channelId: Id;
  userId: Id;
  leftAt: UnixMs;
};
```

### `GET /api/org/:orgid/channels/:channelId/members`

Response:

```ts
type ChannelMemberListResponse = {
  items: Array<{
    member: ChannelMember;
    user: Pick<User, "id" | "kind" | "username" | "firstName" | "lastName" | "avatarUrl">;
  }>;
};
```

## 5.6 Messages, Threads, Attachments, Reactions (Org Scope)

### `GET /api/org/:orgid/channels/:channelId/messages`

Query:

```ts
type MessageListQuery = {
  limit?: number;
  before?: Cursor;
  after?: Cursor;
  around?: Cursor;
  threadRootMessageId?: Id;
};
```

Response:

```ts
type MessageListResponse = MessageListPage;
```

### `POST /api/org/:orgid/messages/send`

Request:

```ts
type MessageSendRequest = {
  channelId: Id;
  text: string;
  threadRootMessageId?: Id;
  attachmentIds?: Id[]; // max 10
  clientMessageId?: string;
};
```

Response:

```ts
type MessageSendResponse = {
  message: MessageView;
};
```

### `POST /api/org/:orgid/messages/:messageId/edit`

Request:

```ts
type MessageEditRequest = {
  text: string;
};
```

Response:

```ts
type MessageEditResponse = {
  message: MessageView;
};
```

### `POST /api/org/:orgid/messages/:messageId/delete`

Request:

```ts
type MessageDeleteRequest = {};
```

Response:

```ts
type MessageDeleteResponse = {
  messageId: Id;
  channelId: Id;
  deletedAt: UnixMs;
};
```

### `POST /api/org/:orgid/messages/:messageId/reactions/add`

Request:

```ts
type MessageReactionAddRequest = {
  shortcode: string;
};
```

Response:

```ts
type MessageReactionAddResponse = {
  messageId: Id;
  reactions: MessageReaction[];
};
```

### `POST /api/org/:orgid/messages/:messageId/reactions/remove`

Request:

```ts
type MessageReactionRemoveRequest = {
  shortcode: string;
};
```

Response:

```ts
type MessageReactionRemoveResponse = {
  messageId: Id;
  reactions: MessageReaction[];
};
```

### `POST /api/org/:orgid/files/upload-init`

Request:

```ts
type FileUploadInitRequest = {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  hashSha256: string;
};
```

Response:

```ts
type FileUploadInitResponse = {
  attachmentId: Id;
  uploadUrl: string;
  uploadHeaders: Record<string, string>;
  expiresAt: UnixMs;
};
```

## 5.7 Typing Indicators (Org Scope)

### `POST /api/org/:orgid/channels/:channelId/typing`

Request:

```ts
type TypingUpsertRequest = {
  isTyping: boolean;
  threadRootMessageId?: Id;
  ttlMs?: number; // default 5000
};
```

Response:

```ts
type TypingUpsertResponse = {
  typing: TypingIndicator;
};
```

### `GET /api/org/:orgid/channels/:channelId/typing`

Response:

```ts
type TypingListResponse = {
  items: TypingIndicator[];
};
```

## 5.8 Read State + Computed Unread (Org Scope)

### `POST /api/org/:orgid/channels/:channelId/read`

Request:

```ts
type ReadStateSetRequest = {
  lastReadMessageId?: Id;
  lastReadAtMs: UnixMs;
};
```

Response:

```ts
type ReadStateSetResponse = {
  readState: ChannelReadState;
};
```

### `GET /api/org/:orgid/channels/:channelId/read-state`
Unread count is computed from messages newer than `lastReadAtMs`.

Response:

```ts
type ReadStateGetResponse = {
  readState: ChannelReadState;
};
```

## 5.9 Update Catch-up (Org Scope)

### `POST /api/org/:orgid/updates/diff`
Returns persisted updates with `seqno > offset`.

Request:

```ts
type UpdatesDiffRequest = {
  offset: number;
};
```

Response:

```ts
type UpdatesDiffResponse = {
  headOffset: number;
  resetRequired: boolean;
  updates: Array<{
    seqno: number;
    event: DaycareSseEvent["event"];
    data: unknown;
    at: UnixMs;
  }>;
};
```

## 6. SSE Schema (Org Scope)

## 6.1 Connection
- Endpoint: `GET /api/org/:orgid/updates/stream`
- Headers: `Accept: text/event-stream`, `Authorization: Bearer <token>`
- Optional header: `Last-Event-ID`
- Keepalive comments are emitted periodically.

## 6.2 Envelope

```ts
type SseEvent<TType extends string, TPayload> = {
  id: string;
  event: TType;
  data: TPayload;
};
```

## 6.3 Events

```ts
type SseEventUserUpdated = SseEvent<"user.updated", { user: User }>;

type SseEventOrganizationUpdated = SseEvent<"organization.updated", { organization: Organization }>;

type SseEventOrganizationJoined = SseEvent<
  "organization.joined",
  {
    organization: Organization;
    user: User;
    membership: OrganizationMembership;
  }
>;

type SseEventOrganizationLeft = SseEvent<
  "organization.left",
  {
    organizationId: Id;
    userId: Id;
    leftAt: UnixMs;
  }
>;

type SseEventMemberJoined = SseEvent<
  "member.joined",
  {
    channelId: Id;
    userId: Id;
    joinedAt: UnixMs;
  }
>;

type SseEventMemberLeft = SseEvent<
  "member.left",
  {
    channelId: Id;
    userId: Id;
    leftAt: UnixMs;
  }
>;

type SseEventChannelCreated = SseEvent<"channel.created", { channel: Channel }>;
type SseEventChannelUpdated = SseEvent<"channel.updated", { channel: Channel }>;

type SseEventMessageCreated = SseEvent<"message.created", { message: MessageView }>;
type SseEventMessageUpdated = SseEvent<"message.updated", { message: MessageView }>;

type SseEventMessageDeleted = SseEvent<
  "message.deleted",
  {
    messageId: Id;
    channelId: Id;
    deletedAt: UnixMs;
  }
>;

type SseEventThreadUpdated = SseEvent<
  "thread.updated",
  {
    channelId: Id;
    threadRootMessageId: Id;
    threadReplyCount: number;
    threadLastReplyAt: UnixMs | null;
  }
>;

type SseEventReactionUpdated = SseEvent<
  "reaction.updated",
  {
    channelId: Id;
    messageId: Id;
    reactions: MessageReaction[];
  }
>;

type SseEventTypingUpdated = SseEvent<
  "typing.updated",
  {
    channelId: Id;
    threadRootMessageId: Id | null;
    items: TypingIndicator[];
  }
>;

type SseEventReadUpdated = SseEvent<
  "read.updated",
  {
    channelId: Id;
    userId: Id;
    readState: ChannelReadState;
  }
>;

type DaycareSseEvent =
  | SseEventUserUpdated
  | SseEventOrganizationUpdated
  | SseEventOrganizationJoined
  | SseEventOrganizationLeft
  | SseEventMemberJoined
  | SseEventMemberLeft
  | SseEventChannelCreated
  | SseEventChannelUpdated
  | SseEventMessageCreated
  | SseEventMessageUpdated
  | SseEventMessageDeleted
  | SseEventThreadUpdated
  | SseEventReactionUpdated
  | SseEventTypingUpdated
  | SseEventReadUpdated;
```

## 7. Validation + Business Rules

- `username`: lowercase `[a-z0-9_]{3,32}`, unique per organization.
- `firstName`: required, trimmed, max 80 chars.
- `lastName`: optional, max 80 chars.
- `timezone`: required IANA timezone string (for example `America/New_York`).
- `organization.slug`: lowercase kebab-case, unique globally.
- `channel.slug`: lowercase kebab-case, unique per organization.
- Reaction shortcode format: `^:[a-z0-9_+-]+:$`.
- Max attachments per message: 10.
- Typing indicators are persisted with TTL and auto-expire.
- Read state is persisted; unread counters are computed from message timeline.
- For `/api/org/:orgid/...` endpoints, caller must be a member of `orgid`.

## 8. Error Matrix

- `UNAUTHORIZED`: missing/invalid/expired token.
- `FORBIDDEN`: no permission for org/channel/action.
- `NOT_FOUND`: org/channel/message/user/file missing.
- `VALIDATION_ERROR`: payload/query/path invalid.
- `CONFLICT`: slug/username collisions, duplicate joins, duplicate idempotency keys.
- `RATE_LIMITED`: auth/message/typing throttled.
- `INTERNAL_ERROR`: unexpected server failure.

## 9. Implementation Mapping

When implementing this schema:
- Cross-cutting types go in `packages/daycare-server/sources/types.ts`.
- Route registries (`_routes.ts`) by domain:
  - `auth/_routes.ts`
  - `organizations/_routes.ts`
  - `users/_routes.ts`
  - `channels/_routes.ts`
  - `messages/_routes.ts`
  - `updates/_routes.ts`
- One public function per file with prefix naming:
  - `organizationCreate.ts`, `organizationJoin.ts`, `organizationAvailableList.ts`
  - `profileCreate.ts`, `profileFirstNameUpdate.ts`, `profileLastNameUpdate.ts`, `profileUsernameUpdate.ts`
  - `messageSend.ts`, `channelCreate.ts`

## 10. Included Features Checklist

- List available organizations for the account
- Query organization by ID
- Create organization
- Join organization
- Leave organization
- Org-prefixed APIs (`/api/org/:orgid/...`)
- Profile create/update endpoints
- Threaded messages
- File attachments
- Reactions
- Typing persistence
- Read-state persistence + computed unread counters
