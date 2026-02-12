import { FileIcon, Download } from "lucide-react";
import { fileSizeFormat } from "@/app/lib/fileUploadCreate";

type MessageDocumentProps = {
  url: string;
  fileName?: string | null;
  sizeBytes?: number | null;
};

export function MessageDocument({ url, fileName, sizeBytes }: MessageDocumentProps) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1 inline-flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm hover:bg-muted transition-colors max-w-sm"
    >
      <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="truncate">{fileName ?? "File"}</span>
      {sizeBytes != null && (
        <span className="text-xs text-muted-foreground shrink-0">
          {fileSizeFormat(sizeBytes)}
        </span>
      )}
      <Download className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
    </a>
  );
}
