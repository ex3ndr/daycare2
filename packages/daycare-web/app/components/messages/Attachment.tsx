import { useEffect, useState, useMemo } from "react";
import { isPreviewableImage, fileSizeFormat } from "@/app/lib/fileUploadCreate";
import { useApp } from "@/app/sync/AppContext";
import { useUiStore } from "@/app/stores/uiStoreContext";
import { FileIcon, Download } from "lucide-react";
import type { PhotoViewerImage } from "@/app/stores/uiStore";

type AttachmentData = {
  id: string;
  kind: string;
  url: string;
  mimeType: string | null;
  fileName: string | null;
  sizeBytes: number | null;
  sortOrder: number;
};

type AttachmentProps = {
  attachment: AttachmentData;
  onImageClick?: () => void;
};

function attachmentFileRefParse(url: string): { orgId: string; fileId: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = new URL(url, window.location.origin);
    const match = parsed.pathname.match(/^\/api\/org\/([^/]+)\/files\/([^/?#]+)$/);
    if (!match) return null;
    return { orgId: match[1], fileId: match[2] };
  } catch {
    return null;
  }
}

function useResolvedUrl(url: string) {
  const app = useApp();
  const [resolvedUrl, setResolvedUrl] = useState(url);

  useEffect(() => {
    let disposed = false;
    setResolvedUrl(url);

    const fileRef = attachmentFileRefParse(url);
    if (!fileRef) return;

    app.api
      .fileGet(app.token, fileRef.orgId, fileRef.fileId)
      .then((response) => {
        if (!response.ok || disposed) return;
        setResolvedUrl(response.url || url);
      })
      .catch(() => {
        // Keep original URL as a fallback if authorized resolution fails.
      });

    return () => {
      disposed = true;
    };
  }, [url, app]);

  return resolvedUrl;
}

export function Attachment({ attachment, onImageClick }: AttachmentProps) {
  const resolvedUrl = useResolvedUrl(attachment.url);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Reset loading state when URL changes
  useEffect(() => {
    setImageLoaded(false);
  }, [attachment.url]);

  if (isPreviewableImage(attachment.mimeType)) {
    return (
      <button
        type="button"
        onClick={onImageClick}
        className="mt-1 inline-block max-w-sm text-left cursor-pointer"
      >
        <div
          className="rounded-md border overflow-hidden bg-muted/30"
          style={!imageLoaded ? { aspectRatio: "16/9", width: "20rem" } : undefined}
        >
          <img
            src={resolvedUrl}
            alt={attachment.fileName ?? "Image"}
            className="rounded-md max-h-64 object-contain"
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
          />
        </div>
        {attachment.fileName && (
          <span className="mt-0.5 block text-xs text-muted-foreground truncate">
            {attachment.fileName}
          </span>
        )}
      </button>
    );
  }

  return (
    <a
      href={resolvedUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1 inline-flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm hover:bg-muted transition-colors max-w-sm"
    >
      <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="truncate">{attachment.fileName ?? "File"}</span>
      {attachment.sizeBytes != null && (
        <span className="text-xs text-muted-foreground shrink-0">
          {fileSizeFormat(attachment.sizeBytes)}
        </span>
      )}
      <Download className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
    </a>
  );
}

type AttachmentListProps = {
  attachments: AttachmentData[];
};

export function AttachmentList({ attachments }: AttachmentListProps) {
  const photoViewerOpen = useUiStore((s) => s.photoViewerOpen);

  // Collect previewable image attachments for multi-image navigation
  const imageAttachments = useMemo(
    () => attachments.filter((a) => isPreviewableImage(a.mimeType)),
    [attachments],
  );

  if (attachments.length === 0) return null;

  function handleImageClick(attachment: AttachmentData) {
    const imageIndex = imageAttachments.findIndex((a) => a.id === attachment.id);
    const images: PhotoViewerImage[] = imageAttachments.map((a) => ({
      url: a.url,
      fileName: a.fileName,
    }));
    photoViewerOpen(images, Math.max(0, imageIndex));
  }

  return (
    <div className="mt-1 flex flex-wrap gap-2">
      {attachments.map((att) => (
        <Attachment
          key={att.id}
          attachment={att}
          onImageClick={
            isPreviewableImage(att.mimeType)
              ? () => handleImageClick(att)
              : undefined
          }
        />
      ))}
    </div>
  );
}
