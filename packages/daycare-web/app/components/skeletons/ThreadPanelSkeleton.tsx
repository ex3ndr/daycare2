export function ThreadPanelSkeleton() {
  return (
    <div className="flex w-80 shrink-0 flex-col border-l bg-background">
      {/* Header skeleton */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2 animate-pulse">
          <div className="h-4 w-4 rounded bg-muted" />
          <div className="h-4 w-14 rounded bg-muted" />
        </div>
      </div>

      {/* Messages skeleton */}
      <div className="flex-1 overflow-hidden">
        <div className="flex flex-col gap-3 p-4 animate-pulse">
          {/* Root message */}
          <div className="flex gap-3">
            <div className="h-9 w-9 rounded-full bg-muted shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-24 rounded bg-muted" />
              <div className="h-3 w-full rounded bg-muted" />
              <div className="h-3 w-3/4 rounded bg-muted" />
            </div>
          </div>

          <div className="border-t my-1" />
          <div className="h-3 w-16 rounded bg-muted" />

          {/* Reply skeletons */}
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex gap-3">
              <div className="h-9 w-9 rounded-full bg-muted shrink-0" />
              <div className="flex-1 space-y-2">
                <div
                  className="h-3.5 rounded bg-muted"
                  style={{ width: `${50 + (i * 19) % 40}px` }}
                />
                <div
                  className="h-3 rounded bg-muted"
                  style={{ width: `${50 + (i * 27) % 40}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
