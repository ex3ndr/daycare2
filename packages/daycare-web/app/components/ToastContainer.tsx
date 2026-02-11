import { useShallow } from "zustand/react/shallow";
import { useToastStore } from "@/app/stores/toastStoreContext";
import { X } from "lucide-react";
import { cn } from "@/app/lib/utils";

const variantStyles: Record<string, string> = {
  default: "bg-foreground text-background",
  success: "bg-green-600 text-white",
  error: "bg-destructive text-destructive-foreground",
  warning: "bg-yellow-600 text-white",
};

export function ToastContainer() {
  const toasts = useToastStore(useShallow((s) => s.toasts));
  const dismiss = useToastStore((s) => s.toastDismiss);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-3 text-sm shadow-lg animate-in slide-in-from-bottom-2 fade-in",
            variantStyles[toast.variant] ?? variantStyles.default,
          )}
        >
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => dismiss(toast.id)}
            className="shrink-0 rounded-sm opacity-70 hover:opacity-100 transition-opacity"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
