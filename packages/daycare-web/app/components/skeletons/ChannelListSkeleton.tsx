export function ChannelListSkeleton() {
  return (
    <div className="py-2 animate-pulse">
      <div className="px-4 py-1.5">
        <div className="h-3 w-16 rounded bg-sidebar-muted" />
      </div>
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex items-center gap-2 px-4 py-1.5">
          <div className="h-4 w-4 rounded bg-sidebar-muted shrink-0" />
          <div
            className="h-3.5 rounded bg-sidebar-muted"
            style={{ width: `${60 + (i * 17) % 40}%` }}
          />
        </div>
      ))}
    </div>
  );
}
