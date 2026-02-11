export function MessageListSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-5 animate-pulse">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex gap-3">
          <div className="h-9 w-9 rounded-full bg-muted shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <div
                className="h-3.5 rounded bg-muted"
                style={{ width: `${60 + (i * 23) % 60}px` }}
              />
              <div className="h-3 w-16 rounded bg-muted" />
            </div>
            <div
              className="h-3 rounded bg-muted"
              style={{ width: `${40 + (i * 31) % 50}%` }}
            />
            {i % 2 === 0 && (
              <div
                className="h-3 rounded bg-muted"
                style={{ width: `${20 + (i * 13) % 30}%` }}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
