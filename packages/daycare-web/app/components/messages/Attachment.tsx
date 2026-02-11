import { useEffect, useState } from "react";
import { isPreviewableImage, fileSizeFormat } from "@/app/lib/fileUploadCreate";
import { useApp } from "@/app/sync/AppContext";
import { FileIcon, Download } from "lucide-react";

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

export function Attachment({ attachment }: AttachmentProps) {
  const app = useApp();
  const [resolvedUrl, setResolvedUrl] = useState(attachment.url);

  useEffect(() => {
    let disposed = false;
    setResolvedUrl(attachment.url);

    const fileRef = attachmentFileRefParse(attachment.url);
    if (!fileRef) return;

    app.api
      .fileGet(app.token, fileRef.orgId, fileRef.fileId)
      .then((response) => {
        if (!response.ok || disposed) return;
        setResolvedUrl(response.url || attachment.url);
      })
      .catch(() => {
        // Keep original URL as a fallback if authorized resolution fails.
      });

    return () => {
      disposed = true;
    };
  }, [attachment.url, app]);

  if (isPreviewableImage(attachment.mimeType)) {
    return (
      <a
        href={resolvedUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 inline-block max-w-sm"
      >
        <img
          src={resolvedUrl}
          alt={attachment.fileName ?? "Image"}
          className="rounded-md border max-h-64 object-contain"
          loading="lazy"
        />
        {attachment.fileName && (
          <span className="mt-0.5 block text-xs text-muted-foreground truncate">
            {attachment.fileName}
          </span>
        )}
      </a>
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
  if (attachments.length === 0) return null;

  return (
    <div className="mt-1 flex flex-wrap gap-2">
      {attachments.map((att) => (
        <Attachment key={att.id} attachment={att} />
      ))}
    </div>
  );
}
