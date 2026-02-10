export async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function exponentialBackoffDelay(
  currentFailureCount: number,
  minDelay: number,
  maxDelay: number,
  maxFailureCount: number
): number {
  const clampedFailures = Math.min(Math.max(currentFailureCount, 1), maxFailureCount);
  const ratio = clampedFailures / maxFailureCount;
  const spread = minDelay + (maxDelay - minDelay) * ratio;

  return Math.round(Math.random() * spread);
}

export type BackoffFunc = <T>(callback: () => Promise<T>) => Promise<T>;

export function createBackoff(options?: {
  onError?: (error: unknown, failuresCount: number) => void;
  minDelay?: number;
  maxDelay?: number;
  maxFailureCount?: number;
}): BackoffFunc {
  return async <T>(callback: () => Promise<T>): Promise<T> => {
    let currentFailureCount = 0;
    const minDelay = options?.minDelay ?? 250;
    const maxDelay = options?.maxDelay ?? 1000;
    const maxFailureCount = options?.maxFailureCount ?? 50;

    while (true) {
      try {
        return await callback();
      } catch (error) {
        if (currentFailureCount < maxFailureCount) {
          currentFailureCount += 1;
        }

        options?.onError?.(error, currentFailureCount);

        const waitForRequest = exponentialBackoffDelay(currentFailureCount, minDelay, maxDelay, maxFailureCount);
        await delay(waitForRequest);
      }
    }
  };
}

export const backoff = createBackoff({
  onError: () => {
    // Intentionally quiet by default; callers can pass their own reporter.
  }
});
