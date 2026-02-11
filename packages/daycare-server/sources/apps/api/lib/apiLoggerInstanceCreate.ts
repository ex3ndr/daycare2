import type { FastifyBaseLogger } from "fastify";
import { getLogger } from "@/utils/getLogger.js";

type LogCall = {
  message: string;
  meta?: unknown;
};

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
      meta: [second, ...rest].filter((value) => value !== undefined)
    };
  }

  if (typeof second === "string") {
    if (rest.length === 0) {
      return {
        message: second,
        meta: first
      };
    }

    return {
      message: second,
      meta: [first, ...rest]
    };
  }

  if (first === undefined) {
    return {
      message: defaultMessage
    };
  }

  return {
    message: defaultMessage,
    meta: [first, second, ...rest].filter((value) => value !== undefined)
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
