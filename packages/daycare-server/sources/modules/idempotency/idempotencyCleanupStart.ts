import type { PrismaClient } from "@prisma/client";
import { getLogger } from "../../utils/getLogger.js";

type CleanupOptions = {
  intervalMs?: number;
  retentionMs?: number;
  batchSize?: number;
};

const DEFAULT_RETENTION_MS = 24 * 60 * 60 * 1000;

export function idempotencyCleanupStart(db: PrismaClient, options: CleanupOptions = {}): () => void {
  const intervalMs = options.intervalMs ?? 300_000;
  const retentionMs = options.retentionMs ?? DEFAULT_RETENTION_MS;
  const batchSize = options.batchSize ?? 1000;
  const logger = getLogger("idempotency.cleanup");

  const interval = setInterval(() => {
    void (async () => {
      const cutoff = new Date(Date.now() - retentionMs);

      const expired = await db.idempotencyKey.findMany({
        where: {
          createdAt: {
            lt: cutoff
          }
        },
        select: {
          id: true
        },
        take: batchSize
      });

      if (expired.length === 0) {
        return;
      }

      await db.idempotencyKey.deleteMany({
        where: {
          id: {
            in: expired.map((item) => item.id)
          }
        }
      });
    })().catch((error) => {
      logger.error("cleanup iteration failed", error);
    });
  }, intervalMs);

  interval.unref();

  return () => {
    clearInterval(interval);
  };
}
