import { Badge } from "@/app/components/ui/badge";
import { Hash, Lock, GripVertical } from "lucide-react";

export function SidebarChannelRow({
  channelId,
  name,
  visibility,
  unreadCount,
  active,
  isDragOver,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onClick,
}: {
  channelId: string;
  name: string;
  visibility: "public" | "private";
  unreadCount: number;
  active: boolean;
  isDragOver: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onClick: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", channelId);
        onDragStart();
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`group flex w-full items-center text-sm transition-colors cursor-grab active:cursor-grabbing ${active ? "bg-sidebar-accent text-sidebar-foreground" : "hover:bg-sidebar-accent"} ${isDragOver ? "border-t-2 border-sidebar-foreground/40" : "border-t-2 border-transparent"}`}
    >
      <div className="flex items-center justify-center w-6 shrink-0 pl-1 opacity-0 group-hover:opacity-60 transition-opacity">
        <GripVertical className="h-3 w-3 text-sidebar-muted-foreground" />
      </div>
      <button
        onClick={onClick}
        className="flex flex-1 items-center gap-2 py-1.5 pr-4 min-w-0"
      >
        {visibility === "private" ? (
          <Lock className={`h-4 w-4 shrink-0 ${active ? "text-sidebar-foreground" : "text-sidebar-muted-foreground"}`} />
        ) : (
          <Hash className={`h-4 w-4 shrink-0 ${active ? "text-sidebar-foreground" : "text-sidebar-muted-foreground"}`} />
        )}
        <span
          className={`truncate ${unreadCount > 0 || active ? "font-semibold text-sidebar-foreground" : "text-sidebar-muted-foreground group-hover:text-sidebar-foreground"}`}
        >
          {name}
        </span>
        {unreadCount > 0 && (
          <Badge variant="accent" size="sm" className="ml-auto shrink-0">
            {unreadCount}
          </Badge>
        )}
      </button>
    </div>
  );
}
