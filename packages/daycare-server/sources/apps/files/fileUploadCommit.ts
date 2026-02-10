import type { FileAsset } from "@prisma/client";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { ApiError } from "@/apps/api/lib/apiError.js";
import { databaseTransactionRun } from "@/modules/database/databaseTransactionRun.js";

type FileUploadCommitInput = {
  organizationId: string;
  userId: string;
  fileId: string;
  payloadBase64: string;
};

export async function fileUploadCommit(
  context: ApiContext,
  input: FileUploadCommitInput
): Promise<FileAsset> {
  const file = await context.db.fileAsset.findFirst({
    where: {
      id: input.fileId,
      organizationId: input.organizationId
    }
  });

  if (!file || file.status !== "PENDING") {
    throw new ApiError(404, "NOT_FOUND", "Pending file not found");
  }

  if (file.createdByUserId !== input.userId) {
    throw new ApiError(403, "FORBIDDEN", "You can upload only files initialized by your account");
  }

  const encodedLengthLimit = Math.ceil(file.sizeBytes * 1.5) + 16;
  if (input.payloadBase64.length > encodedLengthLimit) {
    throw new ApiError(400, "VALIDATION_ERROR", "Uploaded payload is larger than initialized size");
  }

  const payload = Buffer.from(input.payloadBase64, "base64");
  if (payload.length !== file.sizeBytes) {
    throw new ApiError(400, "VALIDATION_ERROR", "Uploaded payload size does not match initialized size");
  }

  const uploadsRoot = path.resolve(process.cwd(), ".daycare", "uploads");
  const uploadPath = path.resolve(uploadsRoot, file.storageKey);
  if (!uploadPath.startsWith(uploadsRoot + path.sep)) {
    throw new ApiError(400, "VALIDATION_ERROR", "Resolved upload path escapes uploads root");
  }

  const contentHash = createHash("sha256").update(payload).digest("hex");
  if (contentHash !== file.contentHash.toLowerCase()) {
    throw new ApiError(400, "VALIDATION_ERROR", "Uploaded payload hash does not match initialized hash");
  }

  await mkdir(path.dirname(uploadPath), { recursive: true });

  let wroteFile = false;
  try {
    await writeFile(uploadPath, payload);
    wroteFile = true;

    const committed = await databaseTransactionRun(context.db, async (tx) => {
      // Optimistic transaction: TOCTU is acceptable; updateMany prevents multi-instance double-commit.
      const updateResult = await tx.fileAsset.updateMany({
        where: {
          id: file.id,
          organizationId: input.organizationId,
          status: "PENDING"
        },
        data: {
          status: "COMMITTED",
          committedAt: new Date(),
          expiresAt: null
        }
      });

      if (updateResult.count === 0) {
        throw new ApiError(404, "NOT_FOUND", "Pending file not found");
      }

      const fresh = await tx.fileAsset.findUnique({
        where: {
          id: file.id
        }
      });

      if (!fresh) {
        throw new ApiError(404, "NOT_FOUND", "Committed file not found");
      }

      return fresh;
    });

    await context.updates.publishToUsers([input.userId], "file.committed", {
      orgId: input.organizationId,
      fileId: file.id
    });

    return committed;
  } catch (error) {
    if (wroteFile) {
      try {
        await unlink(uploadPath);
      } catch {
        // Ignore cleanup errors to preserve the original failure.
      }
    }
    throw error;
  }
}
