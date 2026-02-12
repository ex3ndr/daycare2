import type { FileAsset } from "@prisma/client";
import { createHash } from "node:crypto";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { ApiError } from "@/apps/api/lib/apiError.js";
import { databaseTransactionRun } from "@/modules/database/databaseTransactionRun.js";
import { s3ObjectDelete } from "@/modules/s3/s3ObjectDelete.js";
import { s3ObjectPut } from "@/modules/s3/s3ObjectPut.js";
import { fileImageMetadataExtract } from "./fileImageMetadataExtract.js";

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

  const contentHash = createHash("sha256").update(payload).digest("hex");
  if (contentHash !== file.contentHash.toLowerCase()) {
    throw new ApiError(400, "VALIDATION_ERROR", "Uploaded payload hash does not match initialized hash");
  }

  // Extract image metadata if the file is an image
  let imageMetadata: { width: number; height: number; thumbhash: string } | null = null;
  if (file.mimeType.startsWith("image/")) {
    try {
      imageMetadata = await fileImageMetadataExtract(payload, file.mimeType);
    } catch (err) {
      if (err instanceof Error && (
        err.message.startsWith("File magic bytes do not match") ||
        err.message.startsWith("Could not determine image dimensions")
      )) {
        throw new ApiError(400, "VALIDATION_ERROR", "File content does not match declared image MIME type");
      }
      throw err;
    }
  }

  await s3ObjectPut({
    client: context.s3,
    bucket: context.s3Bucket,
    key: file.storageKey,
    contentType: file.mimeType,
    payload
  });

  let committed: FileAsset;
  try {
    committed = await databaseTransactionRun(context.db, async (tx) => {
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
          expiresAt: null,
          ...(imageMetadata && {
            imageWidth: imageMetadata.width,
            imageHeight: imageMetadata.height,
            imageThumbhash: imageMetadata.thumbhash
          })
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
  } catch (error) {
    try {
      await s3ObjectDelete({
        client: context.s3,
        bucket: context.s3Bucket,
        key: file.storageKey
      });
    } catch {
      // Preserve original failure when rollback also fails.
    }
    throw error;
  }

  await context.updates.publishToUsers([input.userId], "file.committed", {
    orgId: input.organizationId,
    fileId: file.id
  });

  return committed;
}
