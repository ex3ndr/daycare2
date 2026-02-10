import type { PrismaClient } from "@prisma/client";
import { access, rm } from "node:fs/promises";
import path from "node:path";
import { getLogger } from "../../utils/getLogger.js";

type CleanupOptions = {
  intervalMs?: number;
};

async function fileSafeDelete(storageKey: string): Promise<void> {
  const uploadsRoot = path.resolve(process.cwd(), ".daycare", "uploads");
  const filePath = path.resolve(uploadsRoot, storageKey);

  if (!filePath.startsWith(uploadsRoot + path.sep)) {
    return;
  }

  try {
    await access(filePath);
    await rm(filePath, { force: true });
  } catch {
    // File may not exist locally in some deployments.
  }
}

export function fileCleanupStart(db: PrismaClient, options: CleanupOptions = {}): () => void {
  const intervalMs = options.intervalMs ?? 60_000;
  const logger = getLogger("files.cleanup");

  const interval = setInterval(() => {
    void (async () => {
      const now = new Date();

      const expiredPendingFiles = await db.fileAsset.findMany({
        where: {
          status: "PENDING",
          expiresAt: {
            lte: now
          }
        },
        select: {
          id: true,
          storageKey: true
        },
        take: 1000
      });

      if (expiredPendingFiles.length === 0) {
        return;
      }

      await Promise.all(expiredPendingFiles.map((file) => fileSafeDelete(file.storageKey)));

      await db.fileAsset.deleteMany({
        where: {
          id: {
            in: expiredPendingFiles.map((file) => file.id)
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
