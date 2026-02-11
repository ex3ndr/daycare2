import { Prisma } from "@prisma/client";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";

type MessageSearchInput = {
  organizationId: string;
  userId: string;
  query: string;
  channelId?: string;
  before?: number;
  limit?: number;
};

export type MessageSearchResult = Array<{
  id: string;
  chatId: string;
  senderUserId: string;
  text: string;
  highlight: string;
  createdAt: number;
}>;

export async function messageSearch(
  context: ApiContext,
  input: MessageSearchInput
): Promise<MessageSearchResult> {
  const limit = Math.max(1, Math.min(input.limit ?? 20, 100));
  const beforeDate = input.before ? new Date(input.before) : null;
  const channelFilter = input.channelId
    ? Prisma.sql`AND m."chatId" = ${input.channelId}`
    : Prisma.empty;
  const beforeFilter = beforeDate
    ? Prisma.sql`AND m."createdAt" < ${beforeDate}`
    : Prisma.empty;

  const rows = await context.db.$queryRaw<Array<{
    id: string;
    chatId: string;
    senderUserId: string;
    text: string;
    highlight: string | null;
    createdAt: Date;
  }>>(Prisma.sql`
    SELECT
      m."id",
      m."chatId",
      m."senderUserId",
      m."text",
      ts_headline(
        'english',
        m."text",
        plainto_tsquery('english', ${input.query}),
        'StartSel=[[, StopSel=]]'
      ) AS "highlight",
      m."createdAt"
    FROM "Message" m
    INNER JOIN "Chat" c ON c."id" = m."chatId"
    WHERE
      c."organizationId" = ${input.organizationId}
      AND m."deletedAt" IS NULL
      AND (
        c."visibility" = 'PUBLIC'
        OR c."visibility" IS NULL
        OR EXISTS (
          SELECT 1
          FROM "ChatMember" cm
          WHERE cm."chatId" = c."id"
            AND cm."userId" = ${input.userId}
            AND cm."leftAt" IS NULL
        )
      )
      ${channelFilter}
      ${beforeFilter}
      AND m."search_vector" @@ plainto_tsquery('english', ${input.query})
    ORDER BY
      ts_rank_cd(m."search_vector", plainto_tsquery('english', ${input.query})) DESC,
      m."createdAt" DESC
    LIMIT ${limit}
  `);

  return rows.map((row) => ({
    id: row.id,
    chatId: row.chatId,
    senderUserId: row.senderUserId,
    text: row.text,
    highlight: row.highlight ?? row.text,
    createdAt: row.createdAt.getTime()
  }));
}
