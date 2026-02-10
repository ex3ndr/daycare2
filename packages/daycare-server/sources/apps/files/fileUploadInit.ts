import { createId } from "@paralleldrive/cuid2";
import type { FileAsset } from "@prisma/client";
import path from "node:path";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { ApiError } from "@/apps/api/lib/apiError.js";

const PENDING_FILE_TTL_MS = 24 * 60 * 60 * 1000;

function fileNameSanitize(fileName: string): string {
  const baseName = path.basename(fileName).trim();
  const normalized = baseName.replace(/[\\/]/g, "_").replace(/\.\./g, "_");
  const safeName = normalized.length > 0 ? normalized : "file";

  if (safeName.includes("..")) {
    throw new ApiError(400, "VALIDATION_ERROR", "Filename contains invalid path traversal segments");
  }

  return safeName;
}

type FileUploadInitInput = {
  organizationId: string;
  userId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  contentHash: string;
};

export async function fileUploadInit(
  context: ApiContext,
  input: FileUploadInitInput
): Promise<FileAsset> {
  const fileId = createId();
  const safeFileName = fileNameSanitize(input.filename);
  const storageKey = `${input.organizationId}/${input.userId}/${fileId}/${safeFileName}`;

  const file = await context.db.fileAsset.create({
    data: {
      id: fileId,
      organizationId: input.organizationId,
      createdByUserId: input.userId,
      storageKey,
      contentHash: input.contentHash.toLowerCase(),
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      status: "PENDING",
      expiresAt: new Date(Date.now() + PENDING_FILE_TTL_MS)
    }
  });

  await context.updates.publishToUsers([input.userId], "file.pending", {
    orgId: input.organizationId,
    fileId: file.id
  });

  return file;
}
