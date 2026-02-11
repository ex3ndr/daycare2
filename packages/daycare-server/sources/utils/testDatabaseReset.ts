import type { PrismaClient } from "@prisma/client";

const RESET_LOCK_ID = 9123441;

export async function testDatabaseReset(db: PrismaClient): Promise<void> {
  await db.$executeRaw`SELECT pg_advisory_lock(${RESET_LOCK_ID})`;
  try {
    await db.$executeRawUnsafe(
      'TRUNCATE TABLE "UserUpdate", "ChatTypingState", "MessageReaction", "MessageAttachment", "MessageMention", "Message", "Thread", "ChatMember", "Chat", "FileAsset", "OrgInvite", "OrgDomain", "Session", "User", "Account", "Organization" RESTART IDENTITY CASCADE;'
    );
  } finally {
    await db.$executeRaw`SELECT pg_advisory_unlock(${RESET_LOCK_ID})`;
  }
}
