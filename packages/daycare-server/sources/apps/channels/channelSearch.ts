import { Prisma } from "@prisma/client";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";

type ChannelSearchInput = {
  organizationId: string;
  userId: string;
  query: string;
  limit?: number;
};

export type ChannelSearchResult = Array<{
  id: string;
  organizationId: string;
  name: string | null;
  topic: string | null;
  visibility: "public" | "private";
  createdAt: number;
  updatedAt: number;
}>;

export async function channelSearch(
  context: ApiContext,
  input: ChannelSearchInput
): Promise<ChannelSearchResult> {
  const limit = Math.max(1, Math.min(input.limit ?? 20, 100));

  const rows = await context.db.$queryRaw<Array<{
    id: string;
    organizationId: string;
    name: string | null;
    topic: string | null;
    visibility: "PUBLIC" | "PRIVATE" | null;
    createdAt: Date;
    updatedAt: Date;
  }>>(Prisma.sql`
    SELECT
      c."id",
      c."organizationId",
      c."name",
      c."topic",
      c."visibility",
      c."createdAt",
      c."updatedAt"
    FROM "Chat" c
    WHERE
      c."organizationId" = ${input.organizationId}
      AND c."kind" = 'CHANNEL'
      AND c."archivedAt" IS NULL
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
      AND to_tsvector('english', coalesce(c."name", '') || ' ' || coalesce(c."topic", ''))
        @@ plainto_tsquery('english', ${input.query})
    ORDER BY
      ts_rank_cd(
        to_tsvector('english', coalesce(c."name", '') || ' ' || coalesce(c."topic", '')),
        plainto_tsquery('english', ${input.query})
      ) DESC,
      c."updatedAt" DESC
    LIMIT ${limit}
  `);

  return rows.map((row) => ({
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    topic: row.topic,
    visibility: row.visibility?.toLowerCase() === "private" ? "private" : "public",
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime()
  }));
}
