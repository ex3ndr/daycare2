import { useConnectionStore } from "@/app/stores/connectionStoreContext";
import { Loader2, WifiOff } from "lucide-react";

export function ReconnectingBanner() {
  const status = useConnectionStore((s) => s.status);

  if (status === "connected") return null;

  return (
    <div className="flex items-center justify-center gap-2 bg-yellow-600 px-4 py-1.5 text-xs font-medium text-white">
      {status === "reconnecting" ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          Reconnecting...
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3" />
          Connection lost
        </>
      )}
    </div>
  );
}
