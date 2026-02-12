import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useShallow } from "zustand/react/shallow";
import { useApp, useStorage } from "@/app/sync/AppContext";
import { useUiStore } from "@/app/stores/uiStoreContext";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import { Separator } from "@/app/components/ui/separator";
import { Hash, MessageSquare, Headphones, Send, BookUser, Star, LayoutGrid } from "lucide-react";
import { useChannelOrder } from "./Sidebar/sidebarChannelOrder";
import { SidebarNavItem } from "./Sidebar/SidebarNavItem";
import { SidebarHeader } from "./Sidebar/SidebarHeader";
import { SidebarChannelsSection } from "./Sidebar/SidebarChannelsSection";
import { SidebarDirectsSection } from "./Sidebar/SidebarDirectsSection";
import { SidebarCreateChannelDialog } from "./Sidebar/SidebarCreateChannelDialog";
import { SidebarNewMessageDialog } from "./Sidebar/SidebarNewMessageDialog";

const EMPTY_CHANNEL_MAP: Record<string, never> = {};
const EMPTY_DIRECT_MAP: Record<string, never> = {};
const EMPTY_READ_STATE_MAP: Record<string, never> = {};
const EMPTY_PRESENCE_MAP: Record<string, never> = {};

export function Sidebar() {
  const navigate = useNavigate();
  const app = useApp();
  const orgName = useStorage((s) => s.objects.context.orgName);
  const orgSlug = useStorage((s) => s.objects.context.orgSlug);
  const orgId = useStorage((s) => s.objects.context.orgId);
  const channelMap = useStorage(useShallow((s) => s.objects.channel ?? EMPTY_CHANNEL_MAP));
  const directMap = useStorage(useShallow((s) => s.objects.direct ?? EMPTY_DIRECT_MAP));
  const readStates = useStorage(useShallow((s) => s.objects.readState ?? EMPTY_READ_STATE_MAP));
  const presenceMap = useStorage(useShallow((s) => s.objects.presence ?? EMPTY_PRESENCE_MAP));
  const mutate = useStorage((s) => s.mutate);
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);

  const location = useRouterState({ select: (s) => s.location });
  const activeId = useMemo(() => {
    const path = location.pathname;
    const channelMatch = path.match(/\/c\/([^/]+)/);
    if (channelMatch) return channelMatch[1];
    const dmMatch = path.match(/\/dm\/([^/]+)/);
    if (dmMatch) return dmMatch[1];
    return null;
  }, [location.pathname]);

  const channels = useMemo(
    () => Object.values(channelMap).filter((ch) => ch.organizationId === orgId),
    [channelMap, orgId],
  );

  const directs = useMemo(
    () =>
      Object.values(directMap)
        .filter((d) => d.organizationId === orgId)
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [directMap, orgId],
  );

  const [channelDialogOpen, setChannelDialogOpen] = useState(false);
  const [dmDialogOpen, setDmDialogOpen] = useState(false);

  const { sorted: sortedChannels, reorder } = useChannelOrder(orgId, channels);

  // Fetch presence for DM users
  const presenceSyncedRef = useRef<string>("");
  useEffect(() => {
    const userIds = directs.map((d) => d.otherUser.id);
    const key = userIds.sort().join(",");
    if (key === presenceSyncedRef.current || userIds.length === 0) return;
    presenceSyncedRef.current = key;
    app.syncPresence(userIds);
  }, [directs, app]);

  if (sidebarCollapsed) return null;

  return (
    <div className="flex w-[280px] shrink-0 flex-col bg-sidebar text-sidebar-foreground">
      <SidebarHeader orgName={orgName} orgSlug={orgSlug} />

      <ScrollArea className="flex-1">
        <div className="pb-2">
          <div className="space-y-0.5 px-3 pb-3 text-[#d6cde0]">
            <SidebarNavItem icon={<MessageSquare className="h-3.5 w-3.5" />} label="Threads" />
            <SidebarNavItem icon={<Headphones className="h-3.5 w-3.5" />} label="Huddles" />
            <SidebarNavItem icon={<Send className="h-3.5 w-3.5" />} label="Drafts & sent" />
            <SidebarNavItem icon={<BookUser className="h-3.5 w-3.5" />} label="Directories" />
          </div>

          <Separator className="mx-4 mb-2 bg-sidebar-border" />

          <div className="px-4 pb-1">
            <p className="flex items-center gap-1 text-[13px] text-[#d6cde0]">
              <Star className="h-3.5 w-3.5" />
              Starred
            </p>
            <div className="mt-1 space-y-0.5 pl-3">
              {["backend", "design", "dev-talk", "general", "imports"].map((name) => (
                <button
                  key={name}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-[3px] text-left text-sm ${
                    name === "general"
                      ? "bg-[#d9d0de] text-[#4f2d5b]"
                      : "text-[#d6cde0] hover:bg-white/10"
                  }`}
                >
                  <Hash className="h-3.5 w-3.5 shrink-0" />
                  {name}
                </button>
              ))}
            </div>
          </div>

          <SidebarChannelsSection
            channels={sortedChannels}
            activeId={activeId}
            readStates={readStates}
            onNavigate={(channelId) =>
              navigate({ to: "/$orgSlug/c/$channelId", params: { orgSlug, channelId } })
            }
            reorder={reorder}
            onCreateChannel={() => setChannelDialogOpen(true)}
          />

          <SidebarDirectsSection
            directs={directs}
            activeId={activeId}
            readStates={readStates}
            presenceMap={presenceMap}
            onNavigate={(dmId) =>
              navigate({ to: "/$orgSlug/dm/$dmId", params: { orgSlug, dmId } })
            }
            onNewMessage={() => setDmDialogOpen(true)}
          />

          <div className="px-4 pb-1 pt-2">
            <p className="flex items-center gap-1 text-[13px] text-[#d6cde0]">
              <LayoutGrid className="h-3.5 w-3.5" />
              Apps
            </p>
          </div>
        </div>
      </ScrollArea>

      <SidebarCreateChannelDialog
        open={channelDialogOpen}
        onOpenChange={setChannelDialogOpen}
        onCreated={(channelId) => {
          setChannelDialogOpen(false);
          navigate({ to: "/$orgSlug/c/$channelId", params: { orgSlug, channelId } });
        }}
        mutate={mutate}
        api={app.api}
        token={app.token}
        orgId={app.orgId}
      />

      <SidebarNewMessageDialog
        open={dmDialogOpen}
        onOpenChange={setDmDialogOpen}
        onCreated={(dmId) => {
          setDmDialogOpen(false);
          app.syncDirects();
          navigate({ to: "/$orgSlug/dm/$dmId", params: { orgSlug, dmId } });
        }}
        api={app.api}
        token={app.token}
        orgId={app.orgId}
      />
    </div>
  );
}
