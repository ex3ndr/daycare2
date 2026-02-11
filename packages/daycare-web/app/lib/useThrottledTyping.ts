import { useCallback, useRef } from "react";
import type { AppController } from "@/app/sync/AppController";

const THROTTLE_MS = 1500;

// Emits typing signals throttled to at most once per 1.5s per channel
export function useThrottledTyping(
  app: AppController,
  channelId: string,
): () => void {
  const lastEmitRef = useRef<number>(0);
  const lastChannelRef = useRef<string>(channelId);

  // Reset throttle when channel changes
  if (lastChannelRef.current !== channelId) {
    lastChannelRef.current = channelId;
    lastEmitRef.current = 0;
  }

  return useCallback(() => {
    const now = Date.now();
    if (now - lastEmitRef.current < THROTTLE_MS) return;
    lastEmitRef.current = now;
    app.api
      .typingUpsert(app.token, app.orgId, channelId, {})
      .catch(() => {
        // Typing signal failures are non-critical
      });
  }, [app, channelId]);
}
