import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  attachmentKindFromMime,
  isPreviewableImage,
  fileSizeFormat,
  fileUploadCreate,
  type FileUploadState,
} from "./fileUploadCreate";
import type { ApiClient } from "@/app/daycare/api/apiClientCreate";

// --- Pure function tests ---

describe("attachmentKindFromMime", () => {
  it("returns 'image' for image mimes", () => {
    expect(attachmentKindFromMime("image/png")).toBe("image");
    expect(attachmentKindFromMime("image/jpeg")).toBe("image");
    expect(attachmentKindFromMime("image/gif")).toBe("image");
    expect(attachmentKindFromMime("image/webp")).toBe("image");
  });

  it("returns 'video' for video mimes", () => {
    expect(attachmentKindFromMime("video/mp4")).toBe("video");
    expect(attachmentKindFromMime("video/webm")).toBe("video");
  });

  it("returns 'audio' for audio mimes", () => {
    expect(attachmentKindFromMime("audio/mpeg")).toBe("audio");
    expect(attachmentKindFromMime("audio/wav")).toBe("audio");
  });

  it("returns 'file' for other mimes", () => {
    expect(attachmentKindFromMime("application/pdf")).toBe("file");
    expect(attachmentKindFromMime("text/plain")).toBe("file");
    expect(attachmentKindFromMime("application/json")).toBe("file");
  });
});

describe("isPreviewableImage", () => {
  it("returns true for previewable image types", () => {
    expect(isPreviewableImage("image/jpeg")).toBe(true);
    expect(isPreviewableImage("image/png")).toBe(true);
    expect(isPreviewableImage("image/gif")).toBe(true);
    expect(isPreviewableImage("image/webp")).toBe(true);
    expect(isPreviewableImage("image/svg+xml")).toBe(true);
    expect(isPreviewableImage("image/bmp")).toBe(true);
  });

  it("returns false for non-previewable types", () => {
    expect(isPreviewableImage("image/tiff")).toBe(false);
    expect(isPreviewableImage("application/pdf")).toBe(false);
    expect(isPreviewableImage("video/mp4")).toBe(false);
    expect(isPreviewableImage(null)).toBe(false);
  });
});

describe("fileSizeFormat", () => {
  it("formats bytes", () => {
    expect(fileSizeFormat(0)).toBe("0 B");
    expect(fileSizeFormat(500)).toBe("500 B");
  });

  it("formats kilobytes", () => {
    expect(fileSizeFormat(1024)).toBe("1.0 KB");
    expect(fileSizeFormat(1536)).toBe("1.5 KB");
  });

  it("formats megabytes", () => {
    expect(fileSizeFormat(1048576)).toBe("1.0 MB");
    expect(fileSizeFormat(5242880)).toBe("5.0 MB");
  });

  it("formats gigabytes", () => {
    expect(fileSizeFormat(1073741824)).toBe("1.0 GB");
  });

  it("handles null", () => {
    expect(fileSizeFormat(null)).toBe("0 B");
  });
});

// --- State machine tests ---

describe("fileUploadCreate", () => {
  let mockApi: ApiClient;
  let states: FileUploadState[];

  beforeEach(() => {
    states = [];
    mockApi = {
      fileUploadInit: vi.fn().mockResolvedValue({
        file: { id: "file-123", status: "pending" },
        upload: { method: "POST", contentType: "application/json", url: "/upload" },
      }),
      fileUpload: vi.fn().mockResolvedValue({
        file: { id: "file-123", status: "committed" },
      }),
    } as unknown as ApiClient;
  });

  function createUploader() {
    return fileUploadCreate(mockApi, "token-abc", "org-1", {
      onStateChange: (state) => {
        states.push({ ...state, entries: [...state.entries] });
      },
    });
  }

  // Helper: create a File with proper arrayBuffer support for jsdom
  function createTestFile(content: string, name: string, type: string): File {
    return new File([content], name, { type });
  }

  it("starts with empty entries", () => {
    const uploader = createUploader();
    expect(uploader.getState().entries).toEqual([]);
    expect(uploader.allDone()).toBe(true);
    expect(uploader.hasUploading()).toBe(false);
    expect(uploader.hasReady()).toBe(false);
  });

  it("adds files and triggers upload", async () => {
    const uploader = createUploader();
    const file = createTestFile("test content", "test.txt", "text/plain");
    uploader.addFiles([file]);

    // Should have one entry immediately (status may transition fast)
    expect(uploader.getState().entries.length).toBe(1);
    expect(uploader.getState().entries[0].file).toBe(file);

    // Wait for upload to complete
    await vi.waitFor(() => {
      const entry = uploader.getState().entries[0];
      expect(entry.status).toBe("ready");
    });

    const finalEntry = uploader.getState().entries[0];
    expect(finalEntry.status).toBe("ready");
    expect(finalEntry.fileId).toBe("file-123");
    expect(finalEntry.url).toMatch(/\/api\/org\/org-1\/files\/file-123$/);
    expect(finalEntry.progress).toBe(100);
  });

  it("removes a file from entries", () => {
    const uploader = createUploader();
    const file = createTestFile("test", "test.txt", "text/plain");
    uploader.addFiles([file]);

    const entryId = uploader.getState().entries[0].id;
    uploader.removeFile(entryId);

    expect(uploader.getState().entries.length).toBe(0);
  });

  it("clears all entries", () => {
    const uploader = createUploader();
    uploader.addFiles([
      createTestFile("a", "a.txt", "text/plain"),
      createTestFile("b", "b.txt", "text/plain"),
    ]);

    expect(uploader.getState().entries.length).toBe(2);
    uploader.clear();
    expect(uploader.getState().entries.length).toBe(0);
  });

  it("reports error when upload-init fails", async () => {
    (mockApi.fileUploadInit as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Upload init failed"),
    );

    const uploader = createUploader();
    const file = createTestFile("test", "test.txt", "text/plain");
    uploader.addFiles([file]);

    await vi.waitFor(() => {
      const entry = uploader.getState().entries[0];
      expect(entry.status).toBe("error");
    });

    const entry = uploader.getState().entries[0];
    expect(entry.status).toBe("error");
    expect(entry.error).toContain("Upload init failed");
  });

  it("reports error when file upload fails", async () => {
    (mockApi.fileUpload as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Upload data failed"),
    );

    const uploader = createUploader();
    const file = createTestFile("test", "test.txt", "text/plain");
    uploader.addFiles([file]);

    await vi.waitFor(() => {
      const entry = uploader.getState().entries[0];
      expect(entry.status).toBe("error");
    });

    const entry = uploader.getState().entries[0];
    expect(entry.status).toBe("error");
    expect(entry.error).toContain("Upload data failed");
  });

  it("getReadyAttachments returns only ready entries", async () => {
    const uploader = createUploader();
    const file = createTestFile("test", "photo.png", "image/png");
    uploader.addFiles([file]);

    await vi.waitFor(() => {
      const entry = uploader.getState().entries[0];
      expect(entry.status).toBe("ready");
    });

    const attachments = uploader.getReadyAttachments();
    expect(attachments.length).toBe(1);
    expect(attachments[0]).toEqual({
      kind: "image",
      url: expect.stringMatching(/\/api\/org\/org-1\/files\/file-123$/),
      mimeType: "image/png",
      fileName: "photo.png",
      sizeBytes: 4, // "test" is 4 bytes
    });
  });

  it("hasUploading returns true during upload", () => {
    // Make upload hang
    (mockApi.fileUploadInit as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise(() => {}),
    );

    const uploader = createUploader();
    uploader.addFiles([createTestFile("x", "x.txt", "text/plain")]);

    expect(uploader.hasUploading()).toBe(true);
    expect(uploader.hasReady()).toBe(false);
    expect(uploader.allDone()).toBe(false);
  });
});
