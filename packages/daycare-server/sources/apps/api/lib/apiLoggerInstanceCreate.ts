import type { FastifyBaseLogger } from "fastify";
import { getLogger } from "@/utils/getLogger.js";

type LogCall = {
  message: string;
  meta?: unknown;
};

function requestMetaCreate(request: unknown): Record<string, unknown> {
  if (!request || typeof request !== "object") {
    return {};
  }

  const candidate = request as {
    method?: unknown;
    url?: unknown;
    headers?: unknown;
    ip?: unknown;
    socket?: unknown;
  };

  const headers = candidate.headers;
  const socket = candidate.socket as { remotePort?: unknown } | undefined;
  const host = (
    headers
    && typeof headers === "object"
    && "host" in headers
    && typeof headers.host === "string"
  ) ? headers.host : undefined;

  const remoteAddress = typeof candidate.ip === "string" ? candidate.ip : undefined;
  const remotePort = socket && typeof socket.remotePort === "number" ? socket.remotePort : undefined;

  return {
    method: typeof candidate.method === "string" ? candidate.method : undefined,
    url: typeof candidate.url === "string" ? candidate.url : undefined,
    host,
    remoteAddress,
    remotePort
  };
}

function responseMetaCreate(response: unknown): Record<string, unknown> {
  if (!response || typeof response !== "object") {
    return {};
  }

  const candidate = response as {
    statusCode?: unknown;
  };

  return {
    statusCode: typeof candidate.statusCode === "number" ? candidate.statusCode : undefined
  };
}

function errorMetaCreate(error: unknown): unknown {
  if (!(error instanceof Error)) {
    return error;
  }

  return {
    type: error.name,
    message: error.message,
    stack: error.stack
  };
}

function metaNormalize(meta: unknown): unknown {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    return meta;
  }

  const normalized = { ...meta };

  if ("req" in normalized) {
    normalized.req = requestMetaCreate(normalized.req);
  }

  if ("res" in normalized) {
    normalized.res = responseMetaCreate(normalized.res);
  }

  if ("err" in normalized) {
    normalized.err = errorMetaCreate(normalized.err);
  }

  return normalized;
}

function logCallCreate(defaultMessage: string, args: unknown[]): LogCall {
  const [first, second, ...rest] = args;

  if (typeof first === "string") {
    if (second === undefined && rest.length === 0) {
      return {
        message: first
      };
    }

    return {
      message: first,
      meta: [second, ...rest]
        .filter((value) => value !== undefined)
        .map((value) => metaNormalize(value))
    };
  }

  if (typeof second === "string") {
    if (rest.length === 0) {
      return {
        message: second,
        meta: metaNormalize(first)
      };
    }

    return {
      message: second,
      meta: [first, ...rest].map((value) => metaNormalize(value))
    };
  }

  if (first === undefined) {
    return {
      message: defaultMessage
    };
  }

  return {
    message: defaultMessage,
    meta: [first, second, ...rest]
      .filter((value) => value !== undefined)
      .map((value) => metaNormalize(value))
  };
}

function childModuleNameCreate(moduleName: string, bindings: unknown): string {
  if (!bindings || typeof bindings !== "object") {
    return moduleName;
  }

  if (!("reqId" in bindings)) {
    return moduleName;
  }

  const reqId = bindings.reqId;
  if (typeof reqId !== "string" || reqId.length === 0) {
    return moduleName;
  }

  return `${moduleName}.${reqId}`;
}

export function apiLoggerInstanceCreate(moduleName: string): FastifyBaseLogger {
  const logger = getLogger(moduleName);

  return {
    level: "info",
    debug: ((...args: unknown[]) => {
      const call = logCallCreate("fastify debug", args);
      logger.debug(call.message, call.meta);
    }) as FastifyBaseLogger["debug"],
    info: ((...args: unknown[]) => {
      const call = logCallCreate("fastify info", args);
      logger.info(call.message, call.meta);
    }) as FastifyBaseLogger["info"],
    warn: ((...args: unknown[]) => {
      const call = logCallCreate("fastify warn", args);
      logger.warn(call.message, call.meta);
    }) as FastifyBaseLogger["warn"],
    error: ((...args: unknown[]) => {
      const call = logCallCreate("fastify error", args);
      logger.error(call.message, call.meta);
    }) as FastifyBaseLogger["error"],
    fatal: ((...args: unknown[]) => {
      const call = logCallCreate("fastify fatal", args);
      logger.error(call.message, call.meta);
    }) as FastifyBaseLogger["fatal"],
    trace: ((...args: unknown[]) => {
      const call = logCallCreate("fastify trace", args);
      logger.debug(call.message, call.meta);
    }) as FastifyBaseLogger["trace"],
    silent: (() => {
      return;
    }) as FastifyBaseLogger["silent"],
    child: ((bindings: unknown) => {
      return apiLoggerInstanceCreate(childModuleNameCreate(moduleName, bindings));
    }) as FastifyBaseLogger["child"]
  };
}
