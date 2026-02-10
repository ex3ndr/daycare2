# Daycare DB Schema (Prisma Draft)

This document defines a Prisma-first schema proposal for Daycare v1.

## Scope and assumptions

- IDs are generated in application code as `cuid2` strings.
- Database timestamps use Prisma `DateTime`.
- Use `createdAt DateTime @default(now())` and `updatedAt DateTime @updatedAt` for standard row lifecycle fields.
- Convert timestamps to unix milliseconds only at API boundaries if needed.
- Primary database is PostgreSQL.
- v1 is text-only messaging (no threads, attachments, or reactions yet).
- Server is the source of truth; socket events are derived from persisted rows.

## Prisma schema

```prisma
generator client {
  provider = "prisma-client-js"
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

model Organization {
  id        String   @id
  slug      String   @unique
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  users User[]
  chats Chat[]

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
  avatarUrl      String?
  systemPrompt   String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  lastSeenAt     DateTime?

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  account      Account?     @relation(fields: [accountId], references: [id], onDelete: SetNull)

  createdChats Chat[] @relation("ChatCreator")
  memberships ChatMember[]
  sentMessages Message[]       @relation("MessageSender")
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
  messages Message[]

  @@index([organizationId, kind, updatedAt])
}

model ChatMember {
  id                String @id
  chatId            String
  userId            String
  role              ChatMemberRole
  notificationLevel NotificationLevel
  muteUntil         DateTime?
  lastReadAt        DateTime?
  joinedAt          DateTime @default(now())
  leftAt            DateTime?

  chat Chat @relation(fields: [chatId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([chatId, userId])
  @@index([userId, leftAt])
}

model Message {
  id           String @id
  chatId       String
  senderUserId String
  text         String
  createdAt    DateTime @default(now())
  editedAt     DateTime?
  deletedAt    DateTime?

  chat      Chat   @relation(fields: [chatId], references: [id], onDelete: Cascade)
  senderUser User   @relation("MessageSender", fields: [senderUserId], references: [id], onDelete: Restrict)
  mentions  MessageMention[]

  @@index([chatId, createdAt])
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
- A direct chat must have exactly two active members.
- Keep only the latest 5000 rows in `UserUpdate` per user.
