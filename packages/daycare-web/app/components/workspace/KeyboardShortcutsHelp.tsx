import { useEffect, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";

const isMac =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);
const mod = isMac ? "\u2318" : "Ctrl";

const shortcuts = [
  { keys: ["Enter"], description: "Send message" },
  { keys: ["Shift", "Enter"], description: "New line" },
  { keys: [mod, "K"], description: "Open search" },
  { keys: ["Escape"], description: "Close thread / modal / search" },
  { keys: ["\u2191"], description: "Edit last message (empty composer)" },
  { keys: [mod, "/"], description: "Keyboard shortcuts" },
];

export function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    },
    [],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {shortcuts.map((s) => (
            <div
              key={s.description}
              className="flex items-center justify-between"
            >
              <span className="text-sm text-foreground">{s.description}</span>
              <div className="flex items-center gap-1">
                {s.keys.map((key) => (
                  <kbd
                    key={key}
                    className="inline-flex h-6 min-w-[24px] items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-xs text-muted-foreground"
                  >
                    {key}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
