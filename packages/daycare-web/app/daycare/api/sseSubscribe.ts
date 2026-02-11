export type SseEvent = {
  event: string;
  data: string;
  id: string | null;
};

type SseSubscribeArgs = {
  url: string;
  headers?: Record<string, string>;
  onEvent: (event: SseEvent) => void;
  onError?: (error: unknown) => void;
  onEnd?: () => void;
  onUnauthorized?: () => void;
};

type SseSubscription = {
  close: () => void;
};

export function sseSubscribe({ url, headers, onEvent, onError, onEnd, onUnauthorized }: SseSubscribeArgs): SseSubscription {
  const controller = new AbortController();

  const run = async (): Promise<void> => {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "text/event-stream",
          ...(headers ?? {})
        },
        signal: controller.signal
      });

      if (response.status === 401) {
        onUnauthorized?.();
        return;
      }

      if (!response.ok || !response.body) {
        throw new Error(`Failed to connect to stream (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let event = "message";
      let data = "";
      let id: string | null = null;

      const flush = (): void => {
        if (!data && !event) {
          return;
        }
        onEvent({ event, data, id });
        event = "message";
        data = "";
        id = null;
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          if (!controller.signal.aborted) {
            onEnd?.();
          }
          break;
        }
        buffer += decoder.decode(value, { stream: true });

        let lineBreak = buffer.indexOf("\n");
        while (lineBreak !== -1) {
          const line = buffer.slice(0, lineBreak).replace(/\r$/, "");
          buffer = buffer.slice(lineBreak + 1);
          if (line === "") {
            flush();
          } else if (line.startsWith("event:")) {
            event = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            data += line.slice(5).trim();
          } else if (line.startsWith("id:")) {
            id = line.slice(3).trim();
          }
          lineBreak = buffer.indexOf("\n");
        }
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        onError?.(error);
      }
    }
  };

  void run();

  return {
    close: () => controller.abort()
  };
}
