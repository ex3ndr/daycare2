import { useRef, useState } from "react";
import { unreadCountForChannel } from "@/app/sync/selectors";
import { ChannelListSkeleton } from "@/app/components/skeletons/ChannelListSkeleton";
import { Grid2X2, Plus } from "lucide-react";
import { SidebarChannelRow } from "./SidebarChannelRow";

type Channel = {
  id: string;
  name: string;
  visibility: "public" | "private";
};

export function SidebarChannelsSection({
  channels,
  activeId,
  readStates,
  onNavigate,
  reorder,
  onCreateChannel,
}: {
  channels: Channel[];
  activeId: string | null;
  readStates: Record<string, unknown>;
  onNavigate: (channelId: string) => void;
  reorder: (fromId: string, toId: string) => void;
  onCreateChannel: () => void;
}) {
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragItemId = useRef<string | null>(null);

  return (
    <>
      <div className="px-4 pb-1 pt-2">
        <p className="flex items-center gap-1 text-[13px] text-[#d6cde0]">
          <Grid2X2 className="h-3.5 w-3.5" />
          Channels
        </p>
      </div>

      {channels.length === 0 && <ChannelListSkeleton />}
      {channels.length > 0 && (
        <div className="mt-0.5">
          {channels.map((channel) => {
            const unread = unreadCountForChannel(
              { readState: readStates } as Parameters<typeof unreadCountForChannel>[0],
              channel.id,
            );

            return (
              <SidebarChannelRow
                key={channel.id}
                channelId={channel.id}
                name={channel.name}
                visibility={channel.visibility}
                unreadCount={unread}
                active={activeId === channel.id}
                isDragOver={dragOverId === channel.id}
                onDragStart={() => {
                  dragItemId.current = channel.id;
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragItemId.current && dragItemId.current !== channel.id) {
                    setDragOverId(channel.id);
                  }
                }}
                onDragLeave={() => {
                  setDragOverId((prev) => (prev === channel.id ? null : prev));
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragItemId.current && dragItemId.current !== channel.id) {
                    reorder(dragItemId.current, channel.id);
                  }
                  dragItemId.current = null;
                  setDragOverId(null);
                }}
                onDragEnd={() => {
                  dragItemId.current = null;
                  setDragOverId(null);
                }}
                onClick={() => onNavigate(channel.id)}
              />
            );
          })}

          <button
            onClick={onCreateChannel}
            className="flex w-full items-center gap-2 px-4 py-1.5 text-sm text-[#d6cde0] hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Channel
          </button>
        </div>
      )}
    </>
  );
}
