export type Logger = {
  debug: (message: string, meta?: unknown) => void;
  info: (message: string, meta?: unknown) => void;
  warn: (message: string, meta?: unknown) => void;
  error: (message: string, meta?: unknown) => void;
};

const MODULE_LABEL_WIDTH = 20;

function moduleLabelFormat(moduleName: string): string {
  const trimmed = moduleName.trim();
  const base = trimmed.length > 0 ? trimmed : "unknown";

  if (base.length > MODULE_LABEL_WIDTH) {
    return base.slice(0, MODULE_LABEL_WIDTH);
  }

  if (base.length < MODULE_LABEL_WIDTH) {
    return base.padEnd(MODULE_LABEL_WIDTH, " ");
  }

  return base;
}

function timeNowFormat(timestamp: Date = new Date()): string {
  const hh = String(timestamp.getHours()).padStart(2, "0");
  const mm = String(timestamp.getMinutes()).padStart(2, "0");
  const ss = String(timestamp.getSeconds()).padStart(2, "0");
  const ms = String(timestamp.getMilliseconds()).padStart(3, "0");

  return `${hh}:${mm}:${ss}.${ms}`;
}

function logWrite(level: "debug" | "info" | "warn" | "error", moduleName: string, message: string, meta?: unknown): void {
  const line = `[${timeNowFormat()}] [${moduleLabelFormat(moduleName)}] ${message}`;

  if (level === "debug") {
    if (meta !== undefined) {
      console.debug(line, meta);
      return;
    }
    console.debug(line);
    return;
  }

  if (level === "info") {
    if (meta !== undefined) {
      console.info(line, meta);
      return;
    }
    console.info(line);
    return;
  }

  if (level === "warn") {
    if (meta !== undefined) {
      console.warn(line, meta);
      return;
    }
    console.warn(line);
    return;
  }

  if (meta !== undefined) {
    console.error(line, meta);
    return;
  }
  console.error(line);
}

export function getLogger(moduleName: string): Logger {
  return {
    debug: (message, meta) => {
      logWrite("debug", moduleName, message, meta);
    },
    info: (message, meta) => {
      logWrite("info", moduleName, message, meta);
    },
    warn: (message, meta) => {
      logWrite("warn", moduleName, message, meta);
    },
    error: (message, meta) => {
      logWrite("error", moduleName, message, meta);
    }
  };
}
