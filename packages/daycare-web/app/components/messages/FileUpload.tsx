import { useRef, useCallback } from "react";
import { Button } from "@/app/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import type { FileUploadEntry } from "@/app/lib/fileUploadCreate";
import { fileSizeFormat } from "@/app/lib/fileUploadCreate";
import { Paperclip, X, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

type FileUploadButtonProps = {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
};

export function FileUploadButton({ onFilesSelected, disabled }: FileUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        onFilesSelected(Array.from(files));
      }
      // Reset so the same file can be selected again
      e.target.value = "";
    },
    [onFilesSelected],
  );

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleChange}
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0"
            onClick={handleClick}
            disabled={disabled}
            type="button"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Attach files</TooltipContent>
      </Tooltip>
    </>
  );
}

type FileChipProps = {
  entry: FileUploadEntry;
  onRemove: (id: string) => void;
};

function statusIcon(status: FileUploadEntry["status"]) {
  switch (status) {
    case "pending":
    case "hashing":
    case "uploading":
      return <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />;
    case "ready":
      return <CheckCircle2 className="h-3 w-3 text-green-600" />;
    case "error":
      return <AlertCircle className="h-3 w-3 text-destructive" />;
  }
}

function FileChip({ entry, onRemove }: FileChipProps) {
  return (
    <div
      className="flex items-center gap-1.5 rounded-md border bg-muted/50 px-2 py-1 text-xs max-w-48"
      title={entry.error ?? entry.file.name}
    >
      {statusIcon(entry.status)}
      <span className="truncate">{entry.file.name}</span>
      <span className="text-muted-foreground shrink-0">
        {fileSizeFormat(entry.file.size)}
      </span>
      <button
        onClick={() => onRemove(entry.id)}
        className="ml-0.5 shrink-0 rounded-sm p-0.5 hover:bg-muted-foreground/20 transition-colors"
        type="button"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

type FileChipListProps = {
  entries: FileUploadEntry[];
  onRemove: (id: string) => void;
};

export function FileChipList({ entries, onRemove }: FileChipListProps) {
  if (entries.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 px-5 py-2 border-t bg-muted/30">
      {entries.map((entry) => (
        <FileChip key={entry.id} entry={entry} onRemove={onRemove} />
      ))}
    </div>
  );
}
