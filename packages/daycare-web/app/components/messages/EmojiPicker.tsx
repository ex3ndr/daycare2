import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import { Button } from "@/app/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import { SmilePlus } from "lucide-react";
import { pickerEmoji } from "./emojiMap";

type EmojiPickerProps = {
  onSelect: (shortcode: string) => void;
  variant?: "inline" | "icon";
};

export function EmojiPicker({ onSelect, variant = "inline" }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (shortcode: string) => {
    onSelect(shortcode);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            {variant === "icon" ? (
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <SmilePlus className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <button
                className="inline-flex items-center justify-center rounded-full border border-dashed border-border bg-background px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <SmilePlus className="h-3.5 w-3.5" />
              </button>
            )}
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Add reaction</TooltipContent>
      </Tooltip>
      <PopoverContent className="w-auto p-2" align="start" sideOffset={4}>
        <div className="grid grid-cols-5 gap-1">
          {pickerEmoji.map(({ shortcode, emoji }) => (
            <button
              key={shortcode}
              onClick={() => handleSelect(shortcode)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-lg transition-colors hover:bg-accent"
              title={shortcode}
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
