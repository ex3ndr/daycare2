import type { UpdateEnvelope, UpdatesDiffResult } from "../types";

type SyncEngineArgs = {
  updatesDiff: (offset: number) => Promise<UpdatesDiffResult>;
  updatesStreamSubscribe: (onUpdate: (update: UpdateEnvelope) => void, onReady: () => void) => { close: () => void };
  onUpdate: (update: UpdateEnvelope) => void;
  onOffset: (offset: number) => void;
  onResetRequired: (headOffset: number) => Promise<void> | void;
  onState?: (state: "live" | "recovering") => void;
  onError?: (error: unknown) => void;
};

export type SyncEngine = {
  start: () => Promise<void>;
  stop: () => void;
  catchUp: () => Promise<void>;
  offsetGet: () => number;
};

export function syncEngineCreate(args: SyncEngineArgs): SyncEngine {
  let offset = 0;
  let isRunning = false;
  let recoverPromise: Promise<void> | null = null;
  let closeStream: (() => void) | null = null;

  const updateApply = (update: UpdateEnvelope): void => {
    if (update.seqno <= offset) {
      return;
    }
    args.onUpdate(update);
    offset = update.seqno;
    args.onOffset(offset);
  };

  const recover = async (): Promise<void> => {
    if (recoverPromise) {
      return recoverPromise;
    }
    recoverPromise = (async () => {
      try {
        args.onState?.("recovering");
        const diff = await args.updatesDiff(offset);
        if (diff.resetRequired) {
          await args.onResetRequired(diff.headOffset);
          offset = diff.headOffset;
          args.onOffset(offset);
          args.onState?.("live");
          return;
        }
        for (const update of diff.updates) {
          if (update.seqno > offset) {
            updateApply(update);
          }
        }
        args.onState?.("live");
      } catch (error) {
        args.onError?.(error);
      } finally {
        recoverPromise = null;
      }
    })();
    return recoverPromise;
  };

  const streamHandle = (update: UpdateEnvelope): void => {
    if (!isRunning) {
      return;
    }
    if (update.seqno <= offset) {
      return;
    }
    const expected = offset + 1;
    if (update.seqno !== expected) {
      void recover();
      return;
    }
    updateApply(update);
  };

  return {
    start: async () => {
      if (isRunning) {
        return;
      }
      isRunning = true;
      try {
        closeStream = args.updatesStreamSubscribe(streamHandle, () => undefined).close;
        await recover();
      } catch (error) {
        args.onError?.(error);
        throw error;
      }
    },
    stop: () => {
      isRunning = false;
      closeStream?.();
      closeStream = null;
    },
    catchUp: recover,
    offsetGet: () => offset
  };
}
