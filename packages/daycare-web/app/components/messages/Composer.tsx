import { useCallback, useRef } from "react";
import { Textarea } from "@/app/components/ui/textarea";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Link,
  List,
  ListOrdered,
  Code,
  SquareCode,
  Plus,
  ALargeSmall,
  Smile,
  AtSign,
  Video,
  Mic,
  SquareSlash,
  ChevronDown,
} from "lucide-react";
import type { FileUploadEntry } from "@/app/lib/fileUploadCreate";
import { FileChipList } from "./FileUpload";

type ComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: (text: string) => void;
  onTyping?: () => void;
  onEditLastMessage?: () => void;
  placeholder?: string;
  disabled?: boolean;
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed && !hasReadyAttachments) return;
    onSend(trimmed);
    onChange("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
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

  const handleFileClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length > 0 && onFilesSelected) {
        onFilesSelected(files);
      }
      e.target.value = "";
    },
    [onFilesSelected],
  );

  const canSend = (value.trim().length > 0 || hasReadyAttachments) && !isUploading;

  return (
    <div className="px-5 pb-3">
      {/* Attached file chips */}
      {uploadEntries && onFileRemove && (
        <FileChipList entries={uploadEntries} onRemove={onFileRemove} />
      )}

      <div className="rounded-lg border border-[#c8c8cb] bg-background">
        {/* Formatting toolbar */}
        <div className="flex items-center gap-0.5 border-b border-[#e5e5e7] px-2 py-1.5">
          <ToolbarButton icon={Bold} />
          <ToolbarButton icon={Italic} />
          <ToolbarButton icon={Underline} />
          <ToolbarButton icon={Strikethrough} />
          <ToolbarDivider />
          <ToolbarButton icon={Link} />
          <ToolbarDivider />
          <ToolbarButton icon={List} />
          <ToolbarButton icon={ListOrdered} />
          <ToolbarDivider />
          <ToolbarButton icon={Code} />
          <ToolbarButton icon={SquareCode} />
        </div>

        {/* Text area */}
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoResize
          className="min-h-[36px] max-h-[160px] resize-none border-none shadow-none focus-visible:ring-0 px-3 py-2 text-[15px]"
          rows={1}
        />

        {/* Action bar */}
        <div className="flex items-center gap-0.5 border-t border-[#e5e5e7] px-2 py-1.5">
          <ActionButton icon={Plus} onClick={handleFileClick} />
          <ActionButton icon={ALargeSmall} />
          <ActionButton icon={Smile} />
          <ActionButton icon={AtSign} />
          <ActionButton icon={Video} />
          <ActionButton icon={Mic} />
          <ActionButton icon={SquareSlash} />

          <div className="ml-auto flex items-center">
            <button
              onClick={handleSend}
              disabled={disabled || !canSend}
              className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
                canSend
                  ? "bg-[#007a5a] text-white hover:bg-[#006a4e]"
                  : "text-[#b8b8bb]"
              }`}
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
                <path d="M1.5 1.2L14.3 8 1.5 14.8V9.5L10 8 1.5 6.5V1.2z" />
              </svg>
            </button>
            <button className="flex h-7 w-5 items-center justify-center rounded text-[#b8b8bb] hover:bg-[#f0f0f1]">
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Hidden file input */}
      {onFilesSelected && (
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
      )}
    </div>
  );
}

function ToolbarButton({ icon: Icon }: { icon: React.ComponentType<{ className?: string }> }) {
  return (
    <button className="flex h-6 w-6 items-center justify-center rounded text-[#616164] hover:bg-[#f0f0f1] hover:text-[#1d1c1d]">
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function ToolbarDivider() {
  return <div className="mx-1 h-4 w-px bg-[#dddde0]" />;
}

function ActionButton({
  icon: Icon,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded text-[#616164] hover:bg-[#f0f0f1] hover:text-[#1d1c1d]"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
