import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { ApiError } from "@/apps/api/lib/apiError.js";
import { fileUploadCommit } from "@/apps/files/fileUploadCommit.js";
import { fileUploadInit } from "@/apps/files/fileUploadInit.js";
import { authContextResolve } from "@/apps/api/lib/authContextResolve.js";
import { apiResponseOk } from "@/apps/api/lib/apiResponseOk.js";
import { idempotencyGuard } from "@/apps/api/lib/idempotencyGuard.js";
import { rateLimitMiddleware } from "@/apps/api/lib/rateLimitMiddleware.js";
import { s3ObjectGet } from "@/modules/s3/s3ObjectGet.js";

const orgIdSchema = z.string().min(1);
const uploadInitBodySchema = z.object({
  filename: z.string().trim().min(1).max(512),
  mimeType: z.string().trim().min(1).max(256),
  sizeBytes: z.number().int().positive(),
  contentHash: z.string().trim().min(8).max(256)
});

const MAX_BASE64_PAYLOAD_CHARS = 35_000_000;
const uploadBodySchema = z.object({
  payloadBase64: z.string().min(1).max(MAX_BASE64_PAYLOAD_CHARS)
});

export async function fileRoutesRegister(app: FastifyInstance, context: ApiContext): Promise<void> {
  const fileUploadRateLimit = rateLimitMiddleware(context, {
    scope: "files.upload",
    limit: 10,
    windowSeconds: 60,
    keyCreate: async (request) => {
      const params = z.object({ orgid: orgIdSchema }).parse(request.params);
      const auth = await authContextResolve(request, context, params.orgid);
      return auth.user.id;
    },
    message: "Too many file uploads. Please retry later."
  });

  app.post("/api/org/:orgid/files/upload-init", async (request, reply) => {
    const allowed = await fileUploadRateLimit(request, reply);
    if (!allowed) {
      return;
    }

    const params = z.object({ orgid: orgIdSchema }).parse(request.params);
    const body = uploadInitBodySchema.parse(request.body);
    const auth = await authContextResolve(request, context, params.orgid);

    return await idempotencyGuard(request, context, { type: "user", id: auth.user.id }, async () => {
      const file = await fileUploadInit(context, {
        organizationId: params.orgid,
        userId: auth.user.id,
        filename: body.filename,
        mimeType: body.mimeType,
        sizeBytes: body.sizeBytes,
        contentHash: body.contentHash
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
  });

  app.post("/api/org/:orgid/files/:fileId/upload", async (request, reply) => {
    const allowed = await fileUploadRateLimit(request, reply);
    if (!allowed) {
      return;
    }

    const params = z.object({ orgid: orgIdSchema, fileId: z.string().min(1) }).parse(request.params);
    const body = uploadBodySchema.parse(request.body);
    const auth = await authContextResolve(request, context, params.orgid);

    return await idempotencyGuard(request, context, { type: "user", id: auth.user.id }, async () => {
      const committed = await fileUploadCommit(context, {
        organizationId: params.orgid,
        userId: auth.user.id,
        fileId: params.fileId,
        payloadBase64: body.payloadBase64
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
          committedAt: committed.committedAt?.getTime() ?? null,
          imageWidth: committed.imageWidth ?? null,
          imageHeight: committed.imageHeight ?? null,
          imageThumbhash: committed.imageThumbhash ?? null
        }
      });
    });
  });

  app.get("/api/org/:orgid/files/:fileId", async (request, reply) => {
    const params = z.object({ orgid: orgIdSchema, fileId: z.string().min(1) }).parse(request.params);
    const auth = await authContextResolve(request, context, params.orgid);

    if (auth.user.organizationId !== params.orgid) {
      throw new ApiError(403, "FORBIDDEN", "You are not allowed to access this file");
    }

    const file = await context.db.fileAsset.findFirst({
      where: {
        id: params.fileId,
        organizationId: params.orgid,
        status: "COMMITTED"
      }
    });

    if (!file) {
      throw new ApiError(404, "NOT_FOUND", "File not found");
    }

    const signedUrl = await s3ObjectGet({
      client: context.s3,
      bucket: context.s3Bucket,
      key: file.storageKey
    });

    return reply.redirect(signedUrl);
  });
}
