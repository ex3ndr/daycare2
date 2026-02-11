import { useState, useCallback, useRef, useEffect } from "react";
import { fileUploadCreate, type FileUploader, type FileUploadEntry } from "./fileUploadCreate";
import type { ApiClient } from "@/app/daycare/api/apiClientCreate";

export function useFileUpload(api: ApiClient, token: string, orgId: string) {
  const [entries, setEntries] = useState<FileUploadEntry[]>([]);
  const uploaderRef = useRef<FileUploader | null>(null);

  // Create/recreate uploader when api/token/orgId change
  useEffect(() => {
    uploaderRef.current = fileUploadCreate(api, token, orgId, {
      onStateChange: (state) => {
        setEntries([...state.entries]);
      },
    });
    return () => {
      uploaderRef.current = null;
    };
  }, [api, token, orgId]);

  const addFiles = useCallback((files: File[]) => {
    uploaderRef.current?.addFiles(files);
  }, []);

  const removeFile = useCallback((id: string) => {
    uploaderRef.current?.removeFile(id);
  }, []);

  const clear = useCallback(() => {
    uploaderRef.current?.clear();
    setEntries([]);
  }, []);

  const getReadyAttachments = useCallback(() => {
    return uploaderRef.current?.getReadyAttachments() ?? [];
  }, []);

  const hasUploading = entries.some(
    (e) => e.status === "pending" || e.status === "hashing" || e.status === "uploading",
  );

  const hasReady = entries.some((e) => e.status === "ready");

  return {
    entries,
    addFiles,
    removeFile,
    clear,
    getReadyAttachments,
    hasUploading,
    hasReady,
  };
}
