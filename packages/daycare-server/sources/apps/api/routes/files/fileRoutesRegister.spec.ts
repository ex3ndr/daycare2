import type { FastifyInstance } from "fastify";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { describe, expect, it, vi } from "vitest";

const { mkdirMock, writeFileMock } = vi.hoisted(() => ({
  mkdirMock: vi.fn(),
  writeFileMock: vi.fn()
}));

vi.mock("node:fs/promises", () => ({
  mkdir: mkdirMock,
  writeFile: writeFileMock
}));

vi.mock("@/apps/api/lib/authContextResolve.js", () => ({
  authContextResolve: vi.fn()
}));

vi.mock("@/apps/api/lib/idempotencyGuard.js", () => ({
  idempotencyGuard: vi.fn((request: unknown, context: unknown, subject: unknown, handler: () => Promise<unknown>) => handler())
}));

import { createHash } from "node:crypto";
import { authContextResolve } from "@/apps/api/lib/authContextResolve.js";
import { fileRoutesRegister } from "./fileRoutesRegister.js";

describe("fileRoutesRegister", () => {
  it("initializes a pending file and returns upload instructions", async () => {
    const handlers: Record<string, (request: any, reply: any) => Promise<unknown>> = {};
    const app = {
      post: (path: string, handler: (request: any, reply: any) => Promise<unknown>) => {
        handlers[path] = handler;
      }
    } as FastifyInstance;

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

    await fileRoutesRegister(app, context);

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
    const app = {
      post: (path: string, handler: (request: any, reply: any) => Promise<unknown>) => {
        handlers[path] = handler;
      }
    } as FastifyInstance;

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
          update: vi.fn().mockResolvedValue(committed)
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

    await fileRoutesRegister(app, context);

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

    expect(mkdirMock).toHaveBeenCalled();
    expect(writeFileMock).toHaveBeenCalled();
    expect(context.db.fileAsset.update).toHaveBeenCalled();
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
    const app = {
      post: (path: string, handler: (request: any, reply: any) => Promise<unknown>) => {
        handlers[path] = handler;
      }
    } as FastifyInstance;

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

    await fileRoutesRegister(app, context);

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
    const app = {
      post: (path: string, handler: (request: any, reply: any) => Promise<unknown>) => {
        handlers[path] = handler;
      }
    } as FastifyInstance;

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

    await fileRoutesRegister(app, context);

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
    const app = {
      post: (path: string, handler: (request: any, reply: any) => Promise<unknown>) => {
        handlers[path] = handler;
      }
    } as FastifyInstance;

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

    await fileRoutesRegister(app, context);

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

  it("rejects upload when path escapes uploads root", async () => {
    const handlers: Record<string, (request: any, reply: any) => Promise<unknown>> = {};
    const app = {
      post: (path: string, handler: (request: any, reply: any) => Promise<unknown>) => {
        handlers[path] = handler;
      }
    } as FastifyInstance;

    const payload = Buffer.from("data");
    const payloadBase64 = payload.toString("base64");
    const contentHash = createHash("sha256").update(payload).digest("hex");

    const pendingFile = {
      id: "file-1",
      organizationId: "org-1",
      createdByUserId: "user-1",
      storageKey: "../escape.txt",
      contentHash,
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

    await fileRoutesRegister(app, context);

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

  it("rejects upload when payload hash mismatches", async () => {
    const handlers: Record<string, (request: any, reply: any) => Promise<unknown>> = {};
    const app = {
      post: (path: string, handler: (request: any, reply: any) => Promise<unknown>) => {
        handlers[path] = handler;
      }
    } as FastifyInstance;

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

    await fileRoutesRegister(app, context);

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
});
