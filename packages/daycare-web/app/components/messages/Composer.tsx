import { useCallback, useRef } from "react";
import { Button } from "@/app/components/ui/button";
import { Textarea } from "@/app/components/ui/textarea";
import { Send } from "lucide-react";
import type { FileUploadEntry } from "@/app/lib/fileUploadCreate";
import { FileUploadButton, FileChipList } from "./FileUpload";

type ComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: (text: string) => void;
  onTyping?: () => void;
  onEditLastMessage?: () => void;
  placeholder?: string;
  disabled?: boolean;
  // File upload props
  uploadEntries?: FileUploadEntry[];
  onFilesSelected?: (files: File[]) => void;
  onFileRemove?: (id: string) => void;
  hasReadyAttachments?: boolean;
  isUploading?: boolean;
};

export function Composer({
  value,
  onChange,
  onSend,
  onTyping,
  onEditLastMessage,
  placeholder = "Type a message...",
  disabled,
  uploadEntries,
  onFilesSelected,
  onFileRemove,
  hasReadyAttachments,
  isUploading,
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    // Allow sending if there's text OR ready attachments
    if (!trimmed && !hasReadyAttachments) return;
    onSend(trimmed);
    onChange("");
    // Reset textarea height after sending
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    // Re-focus the textarea
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [value, onSend, onChange, hasReadyAttachments]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      } else if (e.key === "ArrowUp" && !value && onEditLastMessage) {
        e.preventDefault();
        onEditLastMessage();
      }
    },
    [handleSend, value, onEditLastMessage],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
      onTyping?.();
    },
    [onChange, onTyping],
  );

  const canSend = (value.trim().length > 0 || hasReadyAttachments) && !isUploading;

  return (
    <div>
      {/* Attached file chips */}
      {uploadEntries && onFileRemove && (
        <FileChipList entries={uploadEntries} onRemove={onFileRemove} />
      )}

      <div className="flex items-end gap-2 border-t bg-background px-5 py-3">
        {onFilesSelected && (
          <FileUploadButton
            onFilesSelected={onFilesSelected}
            disabled={disabled}
          />
        )}
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoResize
          className="min-h-[40px] max-h-[160px] resize-none"
          rows={1}
        />
        <Button
          variant="primary"
          size="icon"
          className="h-10 w-10 shrink-0"
          onClick={handleSend}
          disabled={disabled || !canSend}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
