export function apiResponseFail(code: string, message: string, details?: Record<string, unknown>): {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
} {
  return {
    ok: false,
    error: {
      code,
      message,
      details
    }
  };
}
