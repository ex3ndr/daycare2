import type { ApiClient } from "@/app/daycare/api/apiClientCreate";

export type FileUploadStatus = "pending" | "hashing" | "uploading" | "ready" | "error";

export type FileUploadEntry = {
  id: string;
  file: File;
  status: FileUploadStatus;
  progress: number; // 0-100
  error: string | null;
  // Set after successful upload
  fileId: string | null;
  url: string | null;
};

export type FileUploadState = {
  entries: FileUploadEntry[];
};

export type FileUploadCallbacks = {
  onStateChange: (state: FileUploadState) => void;
};

// Read a file as ArrayBuffer using FileReader (works in jsdom and browsers)
function fileReadAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

// Compute SHA-256 hash of a file as hex string
async function fileSha256(file: File): Promise<string> {
  const buffer = await fileReadAsArrayBuffer(file);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Convert File to base64 string
async function fileToBase64(file: File): Promise<string> {
  const buffer = await fileReadAsArrayBuffer(file);
  const bytes = new Uint8Array(buffer);
  // Process in chunks to avoid stack overflow and O(n^2) string concat
  const CHUNK = 8192;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK) {
    parts.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK)));
  }
  return btoa(parts.join(""));
}

// Determine the attachment kind from MIME type
export function attachmentKindFromMime(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "file";
}

// Check if a MIME type represents an image that can be previewed
export function isPreviewableImage(mimeType: string | null): boolean {
  if (!mimeType) return false;
  return /^image\/(jpeg|jpg|png|gif|webp|svg\+xml|bmp)$/i.test(mimeType);
}

// Format file size for display
export function fileSizeFormat(bytes: number | null): string {
  if (bytes === null || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const k = 1024;
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  const size = bytes / Math.pow(k, i);
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function fileUploadCreate(
  api: ApiClient,
  token: string,
  orgId: string,
  callbacks: FileUploadCallbacks,
) {
  let state: FileUploadState = { entries: [] };

  function updateState(updater: (draft: FileUploadState) => void) {
    updater(state);
    callbacks.onStateChange({ ...state, entries: [...state.entries] });
  }

  function updateEntry(id: string, patch: Partial<FileUploadEntry>) {
    updateState((s) => {
      const idx = s.entries.findIndex((e) => e.id === id);
      if (idx >= 0) {
        s.entries[idx] = { ...s.entries[idx], ...patch };
      }
    });
  }

  async function uploadFile(entry: FileUploadEntry): Promise<void> {
    try {
      // Step 1: Hash the file
      updateEntry(entry.id, { status: "hashing", progress: 10 });
      const contentHash = await fileSha256(entry.file);

      // Step 2: Init upload on server
      updateEntry(entry.id, { status: "uploading", progress: 30 });
      const initResult = await api.fileUploadInit(token, orgId, {
        filename: entry.file.name,
        mimeType: entry.file.type || "application/octet-stream",
        sizeBytes: entry.file.size,
        contentHash,
      });

      // Step 3: Upload base64 payload
      updateEntry(entry.id, { progress: 50 });
      const payloadBase64 = await fileToBase64(entry.file);

      updateEntry(entry.id, { progress: 70 });
      await api.fileUpload(token, orgId, initResult.file.id, { payloadBase64 });

      // Step 4: Build an absolute file URL for API validation compatibility
      const fileUrl = new URL(
        `/api/org/${orgId}/files/${initResult.file.id}`,
        window.location.origin,
      ).toString();

      updateEntry(entry.id, {
        status: "ready",
        progress: 100,
        fileId: initResult.file.id,
        url: fileUrl,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      updateEntry(entry.id, { status: "error", progress: 0, error: message });
    }
  }

  return {
    getState: () => state,

    addFiles(files: File[]) {
      const newEntries: FileUploadEntry[] = files.map((file) => ({
        id: crypto.randomUUID(),
        file,
        status: "pending" as const,
        progress: 0,
        error: null,
        fileId: null,
        url: null,
      }));

      updateState((s) => {
        s.entries = [...s.entries, ...newEntries];
      });

      // Start uploading each file
      for (const entry of newEntries) {
        void uploadFile(entry);
      }
    },

    removeFile(id: string) {
      updateState((s) => {
        s.entries = s.entries.filter((e) => e.id !== id);
      });
    },

    clear() {
      updateState((s) => {
        s.entries = [];
      });
    },

    // Get ready attachments for message sending
    getReadyAttachments(): Array<{
      kind: string;
      url: string;
      mimeType: string | null;
      fileName: string | null;
      sizeBytes: number | null;
    }> {
      return state.entries
        .filter((e) => e.status === "ready" && e.url)
        .map((e) => ({
          kind: attachmentKindFromMime(e.file.type),
          url: e.url!,
          mimeType: e.file.type || null,
          fileName: e.file.name,
          sizeBytes: e.file.size,
        }));
    },

    // Check if all files are done (ready or error)
    allDone(): boolean {
      return state.entries.every((e) => e.status === "ready" || e.status === "error");
    },

    // Check if any files are still uploading
    hasUploading(): boolean {
      return state.entries.some(
        (e) => e.status === "pending" || e.status === "hashing" || e.status === "uploading",
      );
    },

    // Check if there are any ready files
    hasReady(): boolean {
      return state.entries.some((e) => e.status === "ready");
    },
  };
}

export type FileUploader = ReturnType<typeof fileUploadCreate>;
