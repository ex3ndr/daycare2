import type { FastifyInstance } from "fastify";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/apps/api/lib/authContextResolve.js", () => ({
  authContextResolve: vi.fn()
}));

vi.mock("@/apps/api/lib/idempotencyGuard.js", () => ({
  idempotencyGuard: vi.fn((request: unknown, context: unknown, subject: unknown, handler: () => Promise<unknown>) => handler())
}));

vi.mock("@/modules/s3/s3ObjectPut.js", () => ({
  s3ObjectPut: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("@/modules/s3/s3ObjectGet.js", () => ({
  s3ObjectGet: vi.fn().mockResolvedValue("https://example.com/file")
}));

import { createHash } from "node:crypto";
import { authContextResolve } from "@/apps/api/lib/authContextResolve.js";
import { s3ObjectGet } from "@/modules/s3/s3ObjectGet.js";
import { s3ObjectPut } from "@/modules/s3/s3ObjectPut.js";
import { fileRoutesRegister } from "./fileRoutesRegister.js";

type TransactionRunner<DB extends object> = {
  $transaction: <T>(fn: (tx: DB) => Promise<T>) => Promise<T>;
};

function dbWithTransaction<DB extends object>(db: DB): DB & TransactionRunner<DB> {
  return {
    ...db,
    $transaction: async <T>(fn: (tx: DB) => Promise<T>) => fn(db)
  };
}

function contextWithTransaction(context: ApiContext): ApiContext {
  return {
    ...context,
    db: dbWithTransaction(context.db as unknown as Record<string, unknown>)
  } as unknown as ApiContext;
}

function appMockCreate(
  handlers: Record<string, (request: any, reply: any) => Promise<unknown>>
): FastifyInstance {
  return {
    post: (path: string, handler: (request: any, reply: any) => Promise<unknown>) => {
      handlers[path] = handler;
    },
    get: (path: string, handler: (request: any, reply: any) => Promise<unknown>) => {
      handlers[path] = handler;
    }
  } as FastifyInstance;
}

describe("fileRoutesRegister", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes a pending file and returns upload instructions", async () => {
    const handlers: Record<string, (request: any, reply: any) => Promise<unknown>> = {};
    const app = appMockCreate(handlers);

    const created = {
      id: "file-1",
      organizationId: "org-1",
      createdByUserId: "user-1",
      storageKey: "org-1/user-1/file-1/file.txt",
      contentHash: "hash1234",
      mimeType: "text/plain",
      sizeBytes: 4,
      status: "PENDING",
      createdAt: new Date("2026-02-10T00:00:00.000Z"),
      expiresAt: new Date("2026-02-11T00:00:00.000Z")
    };

    const context = {
      db: {
        fileAsset: {
          create: vi.fn().mockResolvedValue(created)
        }
      },
      updates: {
        publishToUsers: vi.fn().mockResolvedValue(undefined)
      }
    } as unknown as ApiContext;

    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "user-1", organizationId: "org-1" } as any
    });

    await fileRoutesRegister(app, contextWithTransaction(context));

    const uploadInit = handlers["/api/org/:orgid/files/upload-init"];
    if (!uploadInit) {
      throw new Error("upload-init handler not registered");
    }
    const result = await uploadInit({
      params: {
        orgid: "org-1"
      },
      body: {
        filename: "file.txt",
        mimeType: "text/plain",
        sizeBytes: 4,
        contentHash: "hash1234"
      }
    }, {} as any);

    expect(context.db.fileAsset.create).toHaveBeenCalled();
    expect(context.updates.publishToUsers).toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: true,
      data: {
        file: {
          id: "file-1",
          organizationId: "org-1",
          status: "pending"
        },
        upload: {
          url: "/api/org/org-1/files/file-1/upload"
        }
      }
    });
  });

  it("accepts file upload and commits asset", async () => {
    const handlers: Record<string, (request: any, reply: any) => Promise<unknown>> = {};
    const app = appMockCreate(handlers);

    const payload = Buffer.from("data");
    const payloadBase64 = payload.toString("base64");
    const contentHash = createHash("sha256").update(payload).digest("hex");

    const pendingFile = {
      id: "file-1",
      organizationId: "org-1",
      createdByUserId: "user-1",
      storageKey: "org-1/user-1/file-1/file.txt",
      contentHash,
      mimeType: "text/plain",
      sizeBytes: payload.length,
      status: "PENDING"
    };

    const committed = {
      ...pendingFile,
      status: "COMMITTED",
      createdAt: new Date("2026-02-10T00:00:00.000Z"),
      committedAt: new Date("2026-02-10T00:00:10.000Z")
    };

    const context = {
      db: {
        fileAsset: {
          findFirst: vi.fn().mockResolvedValue(pendingFile),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findUnique: vi.fn().mockResolvedValue(committed)
        }
      },
      updates: {
        publishToUsers: vi.fn().mockResolvedValue(undefined)
      },
      s3: {} as any,
      s3Bucket: "daycare"
    } as unknown as ApiContext;

    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "user-1", organizationId: "org-1" } as any
    });

    await fileRoutesRegister(app, contextWithTransaction(context));

    const upload = handlers["/api/org/:orgid/files/:fileId/upload"];
    if (!upload) {
      throw new Error("upload handler not registered");
    }
    const result = await upload({
      params: {
        orgid: "org-1",
        fileId: "file-1"
      },
      body: {
        payloadBase64
      }
    }, {} as any);

    expect(s3ObjectPut).toHaveBeenCalled();
    expect(context.db.fileAsset.updateMany).toHaveBeenCalled();
    expect(context.updates.publishToUsers).toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: true,
      data: {
        file: {
          id: "file-1",
          status: "committed"
        }
      }
    });
  });

  it("rejects upload when file is missing", async () => {
    const handlers: Record<string, (request: any, reply: any) => Promise<unknown>> = {};
    const app = appMockCreate(handlers);

    const context = {
      db: {
        fileAsset: {
          findFirst: vi.fn().mockResolvedValue(null)
        }
      }
    } as unknown as ApiContext;

    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "user-1", organizationId: "org-1" } as any
    });

    await fileRoutesRegister(app, contextWithTransaction(context));

    const upload = handlers["/api/org/:orgid/files/:fileId/upload"];
    if (!upload) {
      throw new Error("upload handler not registered");
    }

    await expect(upload({
      params: {
        orgid: "org-1",
        fileId: "file-404"
      },
      body: {
        payloadBase64: Buffer.from("data").toString("base64")
      }
    }, {} as any)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("rejects upload when user does not own file", async () => {
    const handlers: Record<string, (request: any, reply: any) => Promise<unknown>> = {};
    const app = appMockCreate(handlers);

    const pendingFile = {
      id: "file-1",
      organizationId: "org-1",
      createdByUserId: "user-2",
      storageKey: "org-1/user-2/file-1/file.txt",
      contentHash: "hash1234",
      mimeType: "text/plain",
      sizeBytes: 1,
      status: "PENDING"
    };

    const context = {
      db: {
        fileAsset: {
          findFirst: vi.fn().mockResolvedValue(pendingFile)
        }
      }
    } as unknown as ApiContext;

    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "user-1", organizationId: "org-1" } as any
    });

    await fileRoutesRegister(app, contextWithTransaction(context));

    const upload = handlers["/api/org/:orgid/files/:fileId/upload"];
    if (!upload) {
      throw new Error("upload handler not registered");
    }

    await expect(upload({
      params: {
        orgid: "org-1",
        fileId: "file-1"
      },
      body: {
        payloadBase64: Buffer.from("x").toString("base64")
      }
    }, {} as any)).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rejects upload when payload size mismatches initialization", async () => {
    const handlers: Record<string, (request: any, reply: any) => Promise<unknown>> = {};
    const app = appMockCreate(handlers);

    const pendingFile = {
      id: "file-1",
      organizationId: "org-1",
      createdByUserId: "user-1",
      storageKey: "org-1/user-1/file-1/file.txt",
      contentHash: "hash1234",
      mimeType: "text/plain",
      sizeBytes: 4,
      status: "PENDING"
    };

    const context = {
      db: {
        fileAsset: {
          findFirst: vi.fn().mockResolvedValue(pendingFile)
        }
      }
    } as unknown as ApiContext;

    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "user-1", organizationId: "org-1" } as any
    });

    await fileRoutesRegister(app, contextWithTransaction(context));

    const upload = handlers["/api/org/:orgid/files/:fileId/upload"];
    if (!upload) {
      throw new Error("upload handler not registered");
    }

    await expect(upload({
      params: {
        orgid: "org-1",
        fileId: "file-1"
      },
      body: {
        payloadBase64: Buffer.from("abc").toString("base64")
      }
    }, {} as any)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects upload when payload hash mismatches", async () => {
    const handlers: Record<string, (request: any, reply: any) => Promise<unknown>> = {};
    const app = appMockCreate(handlers);

    const payload = Buffer.from("data");
    const payloadBase64 = payload.toString("base64");

    const pendingFile = {
      id: "file-1",
      organizationId: "org-1",
      createdByUserId: "user-1",
      storageKey: "org-1/user-1/file-1/file.txt",
      contentHash: "deadbeef",
      mimeType: "text/plain",
      sizeBytes: payload.length,
      status: "PENDING"
    };

    const context = {
      db: {
        fileAsset: {
          findFirst: vi.fn().mockResolvedValue(pendingFile)
        }
      }
    } as unknown as ApiContext;

    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "user-1", organizationId: "org-1" } as any
    });

    await fileRoutesRegister(app, contextWithTransaction(context));

    const upload = handlers["/api/org/:orgid/files/:fileId/upload"];
    if (!upload) {
      throw new Error("upload handler not registered");
    }

    await expect(upload({
      params: {
        orgid: "org-1",
        fileId: "file-1"
      },
      body: {
        payloadBase64
      }
    }, {} as any)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("returns a signed download URL for committed files", async () => {
    const handlers: Record<string, (request: any, reply: any) => Promise<unknown>> = {};
    const app = appMockCreate(handlers);

    const context = {
      db: {
        fileAsset: {
          findFirst: vi.fn().mockResolvedValue({
            id: "file-1",
            organizationId: "org-1",
            createdByUserId: "user-1",
            storageKey: "org-1/user-1/file-1/file.txt",
            status: "COMMITTED"
          })
        }
      },
      s3: {} as any,
      s3Bucket: "daycare"
    } as unknown as ApiContext;

    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "user-1", organizationId: "org-1" } as any
    });

    await fileRoutesRegister(app, contextWithTransaction(context));

    const download = handlers["/api/org/:orgid/files/:fileId"];
    if (!download) {
      throw new Error("download handler not registered");
    }

    const redirect = vi.fn().mockResolvedValue({ redirected: true });
    const result = await download({
      params: {
        orgid: "org-1",
        fileId: "file-1"
      }
    }, {
      redirect
    } as any);

    expect(s3ObjectGet).toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith("https://example.com/file");
    expect(result).toEqual({ redirected: true });
  });

  it("returns 404 when download file does not exist", async () => {
    const handlers: Record<string, (request: any, reply: any) => Promise<unknown>> = {};
    const app = appMockCreate(handlers);

    const context = {
      db: {
        fileAsset: {
          findFirst: vi.fn().mockResolvedValue(null)
        }
      }
    } as unknown as ApiContext;

    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "user-1", organizationId: "org-1" } as any
    });

    await fileRoutesRegister(app, contextWithTransaction(context));

    const download = handlers["/api/org/:orgid/files/:fileId"];
    if (!download) {
      throw new Error("download handler not registered");
    }

    await expect(download({
      params: {
        orgid: "org-1",
        fileId: "missing"
      }
    }, {} as any)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("returns 403 when download requester org mismatches route org", async () => {
    const handlers: Record<string, (request: any, reply: any) => Promise<unknown>> = {};
    const app = appMockCreate(handlers);

    const context = {
      db: {
        fileAsset: {
          findFirst: vi.fn().mockResolvedValue({
            id: "file-1",
            organizationId: "org-1",
            createdByUserId: "user-2",
            storageKey: "org-1/user-2/file-1/file.txt",
            status: "COMMITTED"
          })
        }
      }
    } as unknown as ApiContext;

    vi.mocked(authContextResolve).mockResolvedValue({
      session: {} as any,
      user: { id: "user-1", organizationId: "org-2" } as any
    });

    await fileRoutesRegister(app, contextWithTransaction(context));

    const download = handlers["/api/org/:orgid/files/:fileId"];
    if (!download) {
      throw new Error("download handler not registered");
    }

    await expect(download({
      params: {
        orgid: "org-1",
        fileId: "file-1"
      }
    }, {} as any)).rejects.toMatchObject({ statusCode: 403 });
  });
});
