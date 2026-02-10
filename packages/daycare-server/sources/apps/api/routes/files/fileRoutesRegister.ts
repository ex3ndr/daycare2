import { createId } from "@paralleldrive/cuid2";
import type { FastifyInstance } from "fastify";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { z } from "zod";
import type { ApiContext } from "../../lib/apiContext.js";
import { ApiError } from "../../lib/apiError.js";
import { authContextResolve } from "../../lib/authContextResolve.js";
import { apiResponseOk } from "../../lib/apiResponseOk.js";

const orgIdSchema = z.string().min(1);
const uploadInitBodySchema = z.object({
  filename: z.string().trim().min(1).max(512),
  mimeType: z.string().trim().min(1).max(256),
  sizeBytes: z.number().int().positive(),
  contentHash: z.string().trim().min(8).max(256)
});

const PENDING_FILE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_BASE64_PAYLOAD_CHARS = 35_000_000;
const uploadBodySchema = z.object({
  payloadBase64: z.string().min(1).max(MAX_BASE64_PAYLOAD_CHARS)
});

function fileNameSanitize(fileName: string): string {
  const baseName = path.basename(fileName).trim();
  const normalized = baseName.replace(/[\\/]/g, "_").replace(/\.\./g, "_");
  const safeName = normalized.length > 0 ? normalized : "file";

  if (safeName.includes("..")) {
    throw new ApiError(400, "VALIDATION_ERROR", "Filename contains invalid path traversal segments");
  }

  return safeName;
}

export async function fileRoutesRegister(app: FastifyInstance, context: ApiContext): Promise<void> {
  app.post("/api/org/:orgid/files/upload-init", async (request) => {
    const params = z.object({ orgid: orgIdSchema }).parse(request.params);
    const body = uploadInitBodySchema.parse(request.body);
    const auth = await authContextResolve(request, context, params.orgid);

    const fileId = createId();
    const safeFileName = fileNameSanitize(body.filename);
    const storageKey = `${params.orgid}/${auth.user.id}/${fileId}/${safeFileName}`;

    const file = await context.db.fileAsset.create({
      data: {
        id: fileId,
        organizationId: params.orgid,
        createdByUserId: auth.user.id,
        storageKey,
        contentHash: body.contentHash.toLowerCase(),
        mimeType: body.mimeType,
        sizeBytes: body.sizeBytes,
        status: "PENDING",
        expiresAt: new Date(Date.now() + PENDING_FILE_TTL_MS)
      }
    });

    await context.updates.publishToUsers([auth.user.id], "file.pending", {
      orgId: params.orgid,
      fileId: file.id
    });

    return apiResponseOk({
      file: {
        id: file.id,
        organizationId: file.organizationId,
        contentHash: file.contentHash,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        status: file.status.toLowerCase(),
        createdAt: file.createdAt.getTime(),
        expiresAt: file.expiresAt?.getTime() ?? null
      },
      upload: {
        method: "POST",
        contentType: "application/json",
        url: `/api/org/${params.orgid}/files/${file.id}/upload`
      }
    });
  });

  app.post("/api/org/:orgid/files/:fileId/upload", async (request) => {
    const params = z.object({ orgid: orgIdSchema, fileId: z.string().min(1) }).parse(request.params);
    const body = uploadBodySchema.parse(request.body);
    const auth = await authContextResolve(request, context, params.orgid);

    const file = await context.db.fileAsset.findFirst({
      where: {
        id: params.fileId,
        organizationId: params.orgid
      }
    });

    if (!file || file.status !== "PENDING") {
      throw new ApiError(404, "NOT_FOUND", "Pending file not found");
    }

    if (file.createdByUserId !== auth.user.id) {
      throw new ApiError(403, "FORBIDDEN", "You can upload only files initialized by your account");
    }

    const encodedLengthLimit = Math.ceil(file.sizeBytes * 1.5) + 16;
    if (body.payloadBase64.length > encodedLengthLimit) {
      throw new ApiError(400, "VALIDATION_ERROR", "Uploaded payload is larger than initialized size");
    }

    const payload = Buffer.from(body.payloadBase64, "base64");
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
    await writeFile(uploadPath, payload);

    const committed = await context.db.fileAsset.update({
      where: {
        id: file.id
      },
      data: {
        status: "COMMITTED",
        committedAt: new Date(),
        expiresAt: null
      }
    });

    await context.updates.publishToUsers([auth.user.id], "file.committed", {
      orgId: params.orgid,
      fileId: file.id
    });

    return apiResponseOk({
      file: {
        id: committed.id,
        organizationId: committed.organizationId,
        contentHash: committed.contentHash,
        mimeType: committed.mimeType,
        sizeBytes: committed.sizeBytes,
        status: committed.status.toLowerCase(),
        createdAt: committed.createdAt.getTime(),
        committedAt: committed.committedAt?.getTime() ?? null
      }
    });
  });
}
