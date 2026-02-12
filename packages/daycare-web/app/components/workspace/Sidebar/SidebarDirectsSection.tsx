import { unreadCountForChannel, presenceForUser } from "@/app/sync/selectors";
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar";
import { Badge } from "@/app/components/ui/badge";
import { MessageSquare, Plus } from "lucide-react";

type Direct = {
  id: string;
  otherUser: {
    id: string;
    firstName: string;
    lastName: string | null;
    avatarUrl: string | null;
  };
};

export function SidebarDirectsSection({
  directs,
  activeId,
  readStates,
  presenceMap,
  onNavigate,
  onNewMessage,
}: {
  directs: Direct[];
  activeId: string | null;
  readStates: Record<string, unknown>;
  presenceMap: Record<string, { status: "online" | "away" | "offline" }>;
  onNavigate: (dmId: string) => void;
  onNewMessage: () => void;
}) {
  return (
    <>
      <div className="px-4 pb-1 pt-2">
        <p className="flex items-center gap-1 text-[13px] text-[#d6cde0]">
          <MessageSquare className="h-3.5 w-3.5" />
          Direct messages
        </p>
      </div>

      <div className="mt-0.5">
        {directs.map((dm) => {
          const unread = unreadCountForChannel(
            { readState: readStates } as Parameters<typeof unreadCountForChannel>[0],
            dm.id,
          );
          const user = dm.otherUser;
          const displayName = user.lastName
            ? `${user.firstName} ${user.lastName}`
            : user.firstName;
          const initials = (user.firstName[0] ?? "") + (user.lastName?.[0] ?? "");

          const userPresence = presenceForUser(presenceMap, user.id);

          const isActive = activeId === dm.id;
          return (
            <button
              key={dm.id}
              onClick={() => onNavigate(dm.id)}
              className={`group flex w-full items-center gap-2 px-4 py-1.5 text-sm transition-colors ${isActive ? "bg-sidebar-accent text-sidebar-foreground" : "hover:bg-sidebar-accent"}`}
            >
              <Avatar size="xs" presence={userPresence}>
                {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={displayName} />}
                <AvatarFallback className="text-[8px]">{initials}</AvatarFallback>
              </Avatar>
              <span
                className={`truncate ${unread > 0 || isActive ? "font-semibold text-sidebar-foreground" : "text-sidebar-muted-foreground group-hover:text-sidebar-foreground"}`}
              >
                {displayName}
              </span>
              {unread > 0 && (
                <Badge variant="accent" size="sm" className="ml-auto shrink-0">
                  {unread}
                </Badge>
              )}
            </button>
          );
        })}

        <button
          onClick={onNewMessage}
          className="flex w-full items-center gap-2 px-4 py-1.5 text-sm text-[#d6cde0] hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Message
        </button>
      </div>
    </>
  );
}
