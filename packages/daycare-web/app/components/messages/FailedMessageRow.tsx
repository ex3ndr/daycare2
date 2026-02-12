import { Button } from "@/app/components/ui/button";
import { AlertCircle, RotateCcw, X } from "lucide-react";
import type { FailedMessageData } from "@/app/stores/uiStore";

type FailedMessageRowProps = {
  id: string;
  message: FailedMessageData;
  onRetry: (id: string) => void;
  onDismiss: (id: string) => void;
};

export function FailedMessageRow({
  id,
  message,
  onRetry,
  onDismiss,
}: FailedMessageRowProps) {
  return (
    <div className="flex gap-3 px-5 py-1.5 bg-destructive/5 border-l-2 border-destructive">
      <div className="w-9 shrink-0 flex items-start justify-center pt-0.5">
        <AlertCircle className="h-4 w-4 text-destructive" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm whitespace-pre-wrap break-words mt-0.5 text-muted-foreground">
          {message.text}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-xs text-destructive">
            Failed to send
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-primary"
            onClick={() => onRetry(id)}
          >
            <RotateCcw className="mr-1 h-3 w-3" />
            Retry
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground"
            onClick={() => onDismiss(id)}
          >
            <X className="mr-1 h-3 w-3" />
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}
