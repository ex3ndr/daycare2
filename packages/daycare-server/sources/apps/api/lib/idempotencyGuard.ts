import type { FastifyRequest } from "fastify";
import { createHash } from "node:crypto";
import { createId } from "@paralleldrive/cuid2";
import { Prisma } from "@prisma/client";
import type { ApiContext } from "./apiContext.js";
import { ApiError } from "./apiError.js";

export type IdempotencySubject = {
  type: "user" | "account";
  id: string;
};

function idempotencyKeyExtract(request: FastifyRequest): string | null {
  const header = request.headers["idempotency-key"];
  if (!header) {
    return null;
  }

  if (Array.isArray(header)) {
    return header[0]?.trim() ?? null;
  }

  return header.trim() || null;
}

function requestHashCreate(request: FastifyRequest, scope: string): string {
  const bodyValue = typeof request.body === "string"
    ? request.body
    : JSON.stringify(request.body ?? {});

  return createHash("sha256")
    .update(scope)
    .update("\n")
    .update(bodyValue)
    .digest("hex");
}

export async function idempotencyGuard<T>(
  request: FastifyRequest,
  context: ApiContext,
  subject: IdempotencySubject,
  handler: () => Promise<T>
): Promise<T> {
  const key = idempotencyKeyExtract(request);
  if (!key) {
    return await handler();
  }

  if (key.length > 200) {
    throw new ApiError(400, "VALIDATION_ERROR", "Idempotency key is too long");
  }

  const scope = `${request.method} ${request.url.split("?")[0]}`;
  const requestHash = requestHashCreate(request, scope);

  const existing = await context.db.idempotencyKey.findUnique({
    where: {
      subjectType_subjectId_scope_key: {
        subjectType: subject.type,
        subjectId: subject.id,
        scope,
        key
      }
    }
  });

  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new ApiError(409, "IDEMPOTENCY_CONFLICT", "Idempotency key reuse with different payload");
    }

    if (!existing.responseJson) {
      throw new ApiError(409, "IDEMPOTENCY_IN_PROGRESS", "Request is already being processed");
    }

    return existing.responseJson as T;
  }

  let record: { id: string };
  try {
    record = await context.db.idempotencyKey.create({
      data: {
        id: createId(),
        subjectType: subject.type,
        subjectId: subject.id,
        scope,
        key,
        requestHash
      }
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const concurrent = await context.db.idempotencyKey.findUnique({
        where: {
          subjectType_subjectId_scope_key: {
            subjectType: subject.type,
            subjectId: subject.id,
            scope,
            key
          }
        }
      });

      if (concurrent && concurrent.requestHash === requestHash && concurrent.responseJson) {
        return concurrent.responseJson as T;
      }

      throw new ApiError(409, "IDEMPOTENCY_IN_PROGRESS", "Request is already being processed");
    }
    throw error;
  }

  try {
    const response = await handler();

    await context.db.idempotencyKey.update({
      where: {
        id: record.id
      },
      data: {
        responseJson: response as Prisma.InputJsonValue
      }
    });

    return response;
  } catch (error) {
    await context.db.idempotencyKey.delete({
      where: {
        id: record.id
      }
    });
    throw error;
  }
}
