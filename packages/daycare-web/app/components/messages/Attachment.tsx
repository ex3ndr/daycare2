import { useEffect, useState, useMemo } from "react";
import { isPreviewableImage } from "@/app/lib/fileUploadCreate";
import { useApp } from "@/app/sync/AppContext";
import { useUiStore } from "@/app/stores/uiStoreContext";
import type { PhotoViewerImage } from "@/app/stores/uiStore";
import { MessagePhoto } from "./MessagePhoto";
import { MessageDocument } from "./MessageDocument";

type AttachmentData = {
  id: string;
  kind: string;
  url: string;
  mimeType: string | null;
  fileName: string | null;
  sizeBytes: number | null;
  sortOrder: number;
  imageWidth: number | null;
  imageHeight: number | null;
  imageThumbhash: string | null;
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

function isPhoto(attachment: AttachmentData): boolean {
  return (
    isPreviewableImage(attachment.mimeType) &&
    attachment.imageWidth != null &&
    attachment.imageHeight != null &&
    attachment.imageWidth > 0 &&
    attachment.imageHeight > 0 &&
    attachment.imageThumbhash != null &&
    attachment.imageThumbhash.length > 0
  );
}

export function Attachment({ attachment, onImageClick }: AttachmentProps) {
  const resolvedUrl = useResolvedUrl(attachment.url);

  if (isPhoto(attachment)) {
    return (
      <MessagePhoto
        url={resolvedUrl}
        width={attachment.imageWidth!}
        height={attachment.imageHeight!}
        thumbhash={attachment.imageThumbhash!}
        fileName={attachment.fileName}
        onClick={onImageClick}
      />
    );
  }

  return (
    <MessageDocument
      url={resolvedUrl}
      fileName={attachment.fileName}
      sizeBytes={attachment.sizeBytes}
    />
  );
}

type AttachmentListProps = {
  attachments: AttachmentData[];
};

export function AttachmentList({ attachments }: AttachmentListProps) {
  const photoViewerOpen = useUiStore((s) => s.photoViewerOpen);

  const imageAttachments = useMemo(
    () => attachments.filter((a) => isPhoto(a)),
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
            isPhoto(att) ? () => handleImageClick(att) : undefined
          }
        />
      ))}
    </div>
  );
}
