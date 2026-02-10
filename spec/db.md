# Daycare DB Schema (Prisma Draft)

This document defines a Prisma-first schema proposal for Daycare v1.

## Scope and assumptions

- IDs are generated in application code as `cuid2` strings.
- Timestamps are unix milliseconds stored as `BigInt`.
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
  id          String @id
  slug        String @unique
  name        String
  createdAtMs BigInt
  updatedAtMs BigInt

  users          User[]
  chats          Chat[]
  activeSessions Session[]

  @@index([createdAtMs])
}

model Account {
  id          String @id
  email       String @unique
  createdAtMs BigInt
  updatedAtMs BigInt

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
  createdAtMs    BigInt
  updatedAtMs    BigInt
  lastSeenAtMs   BigInt?

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
  id                  String @id
  accountId           String
  activeOrganizationId String?
  tokenHash           String @unique
  createdAtMs         BigInt
  expiresAtMs         BigInt
  revokedAtMs         BigInt?
  lastSeenAtMs        BigInt?

  account            Account       @relation(fields: [accountId], references: [id], onDelete: Cascade)
  activeOrganization Organization? @relation(fields: [activeOrganizationId], references: [id], onDelete: SetNull)

  @@index([accountId, expiresAtMs])
}

model Chat {
  id             String @id
  organizationId String
  createdByUserId String?
  kind           ChatKind
  visibility     ChatVisibility?
  name           String?
  topic          String?
  directKey      String? @unique
  createdAtMs    BigInt
  updatedAtMs    BigInt
  archivedAtMs   BigInt?

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  createdByUser User?       @relation("ChatCreator", fields: [createdByUserId], references: [id], onDelete: SetNull)

  members  ChatMember[]
  messages Message[]

  @@index([organizationId, kind, updatedAtMs])
}

model ChatMember {
  id                String @id
  chatId            String
  userId            String
  role              ChatMemberRole
  notificationLevel NotificationLevel
  muteUntilMs       BigInt?
  lastReadAtMs      BigInt?
  joinedAtMs        BigInt
  leftAtMs          BigInt?

  chat Chat @relation(fields: [chatId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([chatId, userId])
  @@index([userId, leftAtMs])
}

model Message {
  id           String @id
  chatId       String
  senderUserId String
  text         String
  createdAtMs  BigInt
  editedAtMs   BigInt?
  deletedAtMs  BigInt?

  chat      Chat   @relation(fields: [chatId], references: [id], onDelete: Cascade)
  senderUser User   @relation("MessageSender", fields: [senderUserId], references: [id], onDelete: Restrict)
  mentions  MessageMention[]

  @@index([chatId, createdAtMs])
  @@index([senderUserId, createdAtMs])
}

model MessageMention {
  id              String @id
  messageId       String
  mentionedUserId String
  createdAtMs     BigInt

  message       Message @relation(fields: [messageId], references: [id], onDelete: Cascade)
  mentionedUser User    @relation("MentionedUser", fields: [mentionedUserId], references: [id], onDelete: Cascade)

  @@unique([messageId, mentionedUserId])
  @@index([mentionedUserId, createdAtMs])
}

model UserUpdate {
  id          String @id
  userId      String
  seqno       Int
  eventType   String
  payloadJson Json
  createdAtMs BigInt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, seqno])
  @@index([userId, createdAtMs])
}
```

## What `Session` is

A `Session` is one authenticated login context (for example: one browser/device login).

- It binds an auth token (`tokenHash`) to an `Account`.
- It has lifecycle timestamps (`createdAtMs`, `expiresAtMs`, optional `revokedAtMs`).
- It stores activity (`lastSeenAtMs`) for idle/online handling.
- It stores `activeOrganizationId` to track which organization the user is currently operating in.

## Service-level invariants

Enforce these invariants in application code (Prisma cannot enforce all of them directly):

- `User.kind = HUMAN`: `accountId` must be non-null and `systemPrompt` must be null.
- `User.kind = AI`: `accountId` must be null and `systemPrompt` must be non-null.
- `Chat.kind = CHANNEL`: `name` and `visibility` must be non-null; `directKey` must be null.
- `Chat.kind = DIRECT`: `directKey` must be non-null; `name` and `visibility` should be null.
- A direct chat must have exactly two active members.
- Keep only the latest 5000 rows in `UserUpdate` per user.
