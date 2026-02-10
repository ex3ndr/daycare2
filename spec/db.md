# Daycare DB Schema (Prisma Draft)

This document defines a Prisma-first schema proposal for Daycare v1.

## Scope and assumptions

- IDs are generated in application code as `cuid2` strings.
- Database timestamps use Prisma `DateTime`.
- Use `createdAt DateTime @default(now())` and `updatedAt DateTime @updatedAt` for standard row lifecycle fields.
- JSON fields are typed via `prisma-json-types-generator`.
- Convert timestamps to unix milliseconds only at API boundaries if needed.
- Primary database is PostgreSQL.
- v1 includes threads, attachments, reactions, mentions, and persisted typing state.
- Server is the source of truth; socket events are derived from persisted rows.

## Prisma schema

```prisma
generator client {
  provider = "prisma-client-js"
}

generator json {
  provider  = "prisma-json-types-generator"
  namespace = "PrismaJson"
  allowAny  = false
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserKind {
  HUMAN
  AI
}

enum ChatKind {
  CHANNEL
  DIRECT
}

enum ChatVisibility {
  PUBLIC
  PRIVATE
}

enum ChatMemberRole {
  OWNER
  MEMBER
}

enum NotificationLevel {
  ALL
  MENTIONS_ONLY
  MUTED
}

enum FileAssetStatus {
  PENDING
  COMMITTED
  DELETED
}

model Organization {
  id        String   @id
  slug      String   @unique
  name      String
  /// [ImageRef]
  avatar    Json?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  users User[]
  chats Chat[]
  files FileAsset[]

  @@index([createdAt])
}

model Account {
  id        String   @id
  email     String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  users    User[]
  sessions Session[]
}

model User {
  id             String   @id
  organizationId String
  accountId      String?
  kind           UserKind
  firstName      String
  lastName       String?
  username       String
  bio            String?
  timezone       String?
  /// [ImageRef]
  avatar         Json?
  systemPrompt   String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  lastSeenAt     DateTime?

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  account      Account?     @relation(fields: [accountId], references: [id], onDelete: SetNull)

  createdChats Chat[] @relation("ChatCreator")
  memberships ChatMember[]
  sentMessages Message[]       @relation("MessageSender")
  reactions   MessageReaction[]
  typingState ChatTypingState[]
  mentions    MessageMention[] @relation("MentionedUser")
  updates     UserUpdate[]

  @@unique([organizationId, username])
  @@unique([organizationId, accountId])
  @@index([organizationId, kind])
}

model Session {
  id         String @id
  accountId  String
  tokenHash  String @unique
  createdAt  DateTime @default(now())
  expiresAt  DateTime
  revokedAt  DateTime?
  lastSeenAt DateTime?

  account Account @relation(fields: [accountId], references: [id], onDelete: Cascade)

  @@index([accountId, expiresAt])
}

model Chat {
  id              String @id
  organizationId  String
  createdByUserId String?
  kind            ChatKind
  visibility      ChatVisibility?
  name            String?
  topic           String?
  directKey       String?   @unique
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  archivedAt      DateTime?

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  createdByUser User?       @relation("ChatCreator", fields: [createdByUserId], references: [id], onDelete: SetNull)

  members  ChatMember[]
  threads  Thread[]
  typing   ChatTypingState[]
  messages Message[]

  @@index([organizationId, kind, updatedAt])
}

model ChatMember {
  id                String @id
  chatId            String
  userId            String
  role              ChatMemberRole
  notificationLevel NotificationLevel
  muteForever       Boolean @default(false)
  muteUntil         DateTime?
  lastReadAt        DateTime?
  joinedAt          DateTime @default(now())
  leftAt            DateTime?

  chat Chat @relation(fields: [chatId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([chatId, userId])
  @@index([userId, leftAt])
}

model Thread {
  id        String   @id // equals the thread root message id
  chatId    String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  chat        Chat    @relation(fields: [chatId], references: [id], onDelete: Cascade)
  rootMessage Message @relation("ThreadRootMessage", fields: [id], references: [id], onDelete: Cascade)
  replies     Message[] @relation("ThreadReplies")

  @@index([chatId, updatedAt])
}

model Message {
  id           String @id
  chatId       String
  senderUserId String
  threadId     String?
  text         String
  /// [MessageMetadata]
  metadata     Json?
  createdAt    DateTime @default(now())
  editedAt     DateTime?
  deletedAt    DateTime?
  threadReplyCount Int      @default(0)
  threadLastReplyAt DateTime?

  chat      Chat   @relation(fields: [chatId], references: [id], onDelete: Cascade)
  senderUser User   @relation("MessageSender", fields: [senderUserId], references: [id], onDelete: Restrict)
  thread    Thread? @relation("ThreadReplies", fields: [threadId], references: [id], onDelete: SetNull)
  rootOfThread Thread? @relation("ThreadRootMessage")
  mentions  MessageMention[]
  attachments MessageAttachment[]
  reactions MessageReaction[]

  @@index([chatId, createdAt])
  @@index([chatId, threadId, createdAt])
  @@index([senderUserId, createdAt])
}

model MessageMention {
  id              String @id
  messageId       String
  mentionedUserId String
  createdAt       DateTime @default(now())

  message       Message @relation(fields: [messageId], references: [id], onDelete: Cascade)
  mentionedUser User    @relation("MentionedUser", fields: [mentionedUserId], references: [id], onDelete: Cascade)

  @@unique([messageId, mentionedUserId])
  @@index([mentionedUserId, createdAt])
}

model MessageAttachment {
  id        String   @id
  messageId String
  fileId    String?
  sortOrder Int
  kind      String // extensible: image, document, audio, ...
  url       String
  mimeType  String?
  fileName  String?
  sizeBytes Int?
  /// [ImageRef]
  image     Json?
  /// [AttachmentMetadata]
  metadata  Json?
  createdAt DateTime @default(now())

  message Message  @relation(fields: [messageId], references: [id], onDelete: Cascade)
  file    FileAsset? @relation(fields: [fileId], references: [id], onDelete: SetNull)

  @@unique([messageId, sortOrder])
  @@index([messageId])
  @@index([fileId])
  @@index([kind])
}

model MessageReaction {
  id        String   @id
  messageId String
  userId    String
  shortcode String // Slack-style shortcode, e.g. :thumbsup:
  createdAt DateTime @default(now())

  message Message @relation(fields: [messageId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([messageId, userId, shortcode])
  @@index([messageId, shortcode])
  @@index([userId, createdAt])
}

model FileAsset {
  id             String   @id
  organizationId String
  storageKey     String   @unique
  contentHash    String // e.g. sha256
  mimeType       String
  sizeBytes      Int
  status         FileAssetStatus
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  expiresAt      DateTime?
  committedAt    DateTime?

  organization Organization       @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  attachments  MessageAttachment[]

  @@index([organizationId, status, createdAt])
  @@index([contentHash])
}

model ChatTypingState {
  id        String   @id
  chatId    String
  userId    String
  expiresAt DateTime
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  chat Chat @relation(fields: [chatId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([chatId, userId])
  @@index([chatId, expiresAt])
}

model UserUpdate {
  id          String @id
  userId      String
  seqno       Int
  eventType   String
  payloadJson Json
  createdAt   DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, seqno])
  @@index([userId, createdAt])
}
```

## Prisma JSON type declarations

Create a declaration file included by `tsconfig.json` (example: `packages/daycare-server/sources/prisma-json.d.ts`):

```ts
export {};

declare global {
  namespace PrismaJson {
    type ImageRef = {
      fullUrl: string;
      width: number;
      height: number;
      thumbhash: string;
    };

    type MessageMetadata = Record<string, unknown>;

    type AttachmentMetadata = Record<string, unknown>;
  }
}
```

`ImageRef` is used by avatar fields (`Organization.avatar` and `User.avatar`) and image attachments (`MessageAttachment.image`).

## What `Session` is

A `Session` is one authenticated login context (for example: one browser/device login).

- It binds an auth token (`tokenHash`) to an `Account`.
- It has lifecycle timestamps (`createdAt`, `expiresAt`, optional `revokedAt`).
- It stores activity (`lastSeenAt`) for idle/online handling.
- It is organization-agnostic; the same session can access any organization the account has membership in.

## Service-level invariants

Enforce these invariants in application code (Prisma cannot enforce all of them directly):

- `User.kind = HUMAN`: `accountId` must be non-null and `systemPrompt` must be null.
- `User.kind = AI`: `accountId` must be null and `systemPrompt` must be non-null.
- `Chat.kind = CHANNEL`: `name` and `visibility` must be non-null; `directKey` must be null.
- `Chat.kind = DIRECT`: `directKey` must be non-null; `name` and `visibility` should be null.
- `Message.metadata` is optional JSON; clients may omit it.
- A message can have at most 10 attachments.
- `MessageAttachment.kind = "image"` requires a non-null `image` object (`fullUrl`, `width`, `height`, `thumbhash`).
- `Thread.id` equals the root message id; replies use `Message.threadId = Thread.id`.
- `Message.threadReplyCount` and `Message.threadLastReplyAt` are denormalized on the thread root message.
- Reaction format must be Slack shortcode (`:emoji_name:` style).
- Typing state is persisted in `ChatTypingState` with short TTL; expired rows are cleaned automatically.
- `FileAsset.status = PENDING` must have `expiresAt` (24h binding window before cleanup).
- A direct chat must have exactly two active members.
- Unread counters are computed from `ChatMember.lastReadAt`; do not persist incrementing unread counters.
- Keep only the latest 5000 rows in `UserUpdate` per user.
