export function apiResponseOk<T>(data: T): { ok: true; data: T } {
  return {
    ok: true,
    data
  };
}
