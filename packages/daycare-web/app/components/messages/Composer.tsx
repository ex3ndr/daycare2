import { useCallback, useRef } from "react";
import { Button } from "@/app/components/ui/button";
import { Textarea } from "@/app/components/ui/textarea";
import { Send } from "lucide-react";

type ComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: (text: string) => void;
  onTyping?: () => void;
  placeholder?: string;
  disabled?: boolean;
};

export function Composer({
  value,
  onChange,
  onSend,
  onTyping,
  placeholder = "Type a message...",
  disabled,
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    onChange("");
    // Reset textarea height after sending
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    // Re-focus the textarea
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [value, onSend, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
      onTyping?.();
    },
    [onChange, onTyping],
  );

  return (
    <div className="flex items-end gap-2 border-t bg-background px-5 py-3">
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
        disabled={disabled || !value.trim()}
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}
