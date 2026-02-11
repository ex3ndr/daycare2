import { isPreviewableImage, fileSizeFormat } from "@/app/lib/fileUploadCreate";
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

export function Attachment({ attachment }: AttachmentProps) {
  if (isPreviewableImage(attachment.mimeType)) {
    return (
      <a
        href={attachment.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 inline-block max-w-sm"
      >
        <img
          src={attachment.url}
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
      href={attachment.url}
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
