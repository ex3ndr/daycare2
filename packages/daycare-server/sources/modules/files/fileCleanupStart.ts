import type { PrismaClient } from "@prisma/client";
import type { DaycareS3Client } from "@/modules/s3/s3ClientCreate.js";
import { s3ObjectDelete } from "@/modules/s3/s3ObjectDelete.js";
import { getLogger } from "@/utils/getLogger.js";

type CleanupOptions = {
  intervalMs?: number;
};

export function fileCleanupStart(
  db: PrismaClient,
  s3: DaycareS3Client,
  s3Bucket: string,
  options: CleanupOptions = {}
): () => void {
  const intervalMs = options.intervalMs ?? 60_000;
  const logger = getLogger("files.cleanup");

  const interval = setInterval(() => {
    void (async () => {
      const now = new Date();

      const filesToDelete = await db.fileAsset.findMany({
        where: {
          OR: [
            {
              status: "PENDING",
              expiresAt: {
                lte: now
              }
            },
            {
              status: "DELETED"
            }
          ]
        },
        select: {
          id: true,
          storageKey: true
        },
        take: 1000
      });

      if (filesToDelete.length === 0) {
        return;
      }

      const deletedFileIds: string[] = [];
      for (const file of filesToDelete) {
        try {
          await s3ObjectDelete({
            client: s3,
            bucket: s3Bucket,
            key: file.storageKey
          });
          deletedFileIds.push(file.id);
        } catch (error) {
          logger.warn("cleanup object delete failed", {
            fileId: file.id,
            storageKey: file.storageKey,
            error
          });
        }
      }

      if (deletedFileIds.length === 0) {
        return;
      }

      await db.fileAsset.deleteMany({
        where: {
          id: {
            in: deletedFileIds
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
