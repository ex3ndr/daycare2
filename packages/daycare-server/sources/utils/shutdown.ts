import { getLogger, type Logger } from "./getLogger.js";

type ShutdownHandler = () => void | Promise<void>;

export type ShutdownSignal = {
  readonly aborted: boolean;
  addEventListener: (type: "abort", listener: () => void) => void;
  removeEventListener: (type: "abort", listener: () => void) => void;
};

export type ShutdownManager = {
  shutdownSignal: ShutdownSignal;
  onShutdown: (name: string, handler: ShutdownHandler) => () => void;
  awaitShutdown: () => Promise<NodeJS.Signals | "fatal">;
  requestShutdown: (signal?: NodeJS.Signals | "fatal") => void;
};

export type ShutdownManagerOptions = {
  forceExitMs?: number;
  logger?: Logger;
  onForceExit?: () => void;
  attachProcessHandlers?: boolean;
};

export function shutdownManagerCreate(options: ShutdownManagerOptions = {}): ShutdownManager {
  const shutdownHandlers = new Map<string, ShutdownHandler[]>();
  const shutdownController = new AbortController();
  const logger = options.logger ?? getLogger("shutdown");

  const forceExitMs = options.forceExitMs ?? 1000;
  const onForceExit = options.onForceExit ?? (() => process.exit(1));
  const attachProcessHandlers = options.attachProcessHandlers ?? true;

  let shutdownPromise: Promise<NodeJS.Signals | "fatal"> | null = null;
  let resolveShutdown: ((signal: NodeJS.Signals | "fatal") => void) | null = null;
  let shutdownRequestedSignal: NodeJS.Signals | "fatal" | null = null;
  let shutdownCompletion: Promise<void> | null = null;
  let handlersAttached = false;
  let shuttingDown = false;

  const onShutdown = (name: string, handler: ShutdownHandler): (() => void) => {
    if (shutdownController.signal.aborted) {
      void handler();
      return () => {};
    }

    const handlers = shutdownHandlers.get(name) ?? [];
    handlers.push(handler);
    shutdownHandlers.set(name, handlers);

    return () => {
      const list = shutdownHandlers.get(name);
      if (!list) {
        return;
      }

      const index = list.indexOf(handler);
      if (index !== -1) {
        list.splice(index, 1);
      }

      if (list.length === 0) {
        shutdownHandlers.delete(name);
      }
    };
  };

  const resolveWhenComplete = (signal: NodeJS.Signals | "fatal"): void => {
    if (!resolveShutdown) {
      return;
    }

    const completion = shutdownCompletion ?? Promise.resolve();
    completion.then(() => resolveShutdown?.(signal));
  };

  const triggerShutdown = async (): Promise<void> => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    shutdownController.abort();

    const forceExit = setTimeout(() => {
      logger.error(`Shutdown: forcing process exit after ${forceExitMs}ms`);
      onForceExit();
    }, forceExitMs);
    forceExit.unref();

    const snapshot = new Map<string, ShutdownHandler[]>();
    for (const [name, handlers] of shutdownHandlers) {
      snapshot.set(name, [...handlers]);
    }

    const totalHandlers = Array.from(snapshot.values()).reduce((total, handlers) => total + handlers.length, 0);
    logger.info(`Shutdown: running ${totalHandlers} handler${totalHandlers === 1 ? "" : "s"}`);

    const tasks: Promise<unknown>[] = [];
    for (const [name, handlers] of snapshot) {
      handlers.forEach((handler, index) => {
        tasks.push(
          Promise.resolve()
            .then(() => handler())
            .catch((error) => {
              logger.warn(`Shutdown: handler ${name}[${index + 1}] failed`, error);
            })
        );
      });
    }

    if (tasks.length > 0) {
      await Promise.allSettled(tasks);
    }

    clearTimeout(forceExit);
  };

  const requestShutdown = (signal: NodeJS.Signals | "fatal" = "SIGTERM"): void => {
    if (shutdownRequestedSignal) {
      return;
    }

    shutdownRequestedSignal = signal;
    shutdownCompletion = triggerShutdown();
    resolveWhenComplete(signal);
  };

  const awaitShutdown = async (): Promise<NodeJS.Signals | "fatal"> => {
    if (!shutdownPromise) {
      shutdownPromise = new Promise((resolve) => {
        resolveShutdown = resolve;
        const handler = (signal: NodeJS.Signals) => {
          requestShutdown(signal);
        };

        if (attachProcessHandlers && !handlersAttached) {
          handlersAttached = true;
          process.once("SIGINT", handler);
          process.once("SIGTERM", handler);
        }

        if (shutdownRequestedSignal) {
          resolveWhenComplete(shutdownRequestedSignal);
        }
      });
    }

    return shutdownPromise;
  };

  return {
    shutdownSignal: shutdownController.signal,
    onShutdown,
    awaitShutdown,
    requestShutdown
  };
}

let defaultShutdownManager: ShutdownManager | null = null;

function shutdownManagerDefaultGet(): ShutdownManager {
  if (!defaultShutdownManager) {
    defaultShutdownManager = shutdownManagerCreate();
  }

  return defaultShutdownManager;
}

export function shutdownSignalGet(): ShutdownSignal {
  return shutdownManagerDefaultGet().shutdownSignal;
}

export function onShutdown(name: string, handler: ShutdownHandler): () => void {
  return shutdownManagerDefaultGet().onShutdown(name, handler);
}

export async function awaitShutdown(): Promise<NodeJS.Signals | "fatal"> {
  return shutdownManagerDefaultGet().awaitShutdown();
}

export function requestShutdown(signal: NodeJS.Signals | "fatal" = "SIGTERM"): void {
  shutdownManagerDefaultGet().requestShutdown(signal);
}
