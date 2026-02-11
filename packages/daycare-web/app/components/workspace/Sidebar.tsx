import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useShallow } from "zustand/react/shallow";
import { useApp, useStorage } from "@/app/sync/AppContext";
import { unreadCountForChannel, presenceForUser } from "@/app/sync/selectors";
import { useUiStore } from "@/app/stores/uiStoreContext";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Separator } from "@/app/components/ui/separator";
import { Input } from "@/app/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/app/components/ui/dialog";
import { Hash, Lock, Plus, MessageSquare, ChevronDown, ChevronRight } from "lucide-react";
import type { ApiClient } from "@/app/daycare/api/apiClientCreate";
import { ChannelListSkeleton } from "@/app/components/skeletons/ChannelListSkeleton";

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

  const [channelsOpen, setChannelsOpen] = useState(true);
  const [dmsOpen, setDmsOpen] = useState(true);
  const [channelDialogOpen, setChannelDialogOpen] = useState(false);
  const [dmDialogOpen, setDmDialogOpen] = useState(false);

  const sortedChannels = [...channels].sort((a, b) => a.name.localeCompare(b.name));

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
      {/* Org header */}
      <div className="flex h-14 items-center px-4">
        <h2 className="font-display text-lg font-semibold truncate">{orgName}</h2>
      </div>

      <Separator className="bg-sidebar-border" />

      <ScrollArea className="flex-1">
        <div className="py-2">
          {/* Channels section */}
          <button
            onClick={() => setChannelsOpen(!channelsOpen)}
            className="flex w-full items-center gap-1 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-sidebar-muted-foreground hover:text-sidebar-foreground transition-colors"
          >
            {channelsOpen ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            Channels
          </button>

          {channelsOpen && sortedChannels.length === 0 && (
            <ChannelListSkeleton />
          )}
          {channelsOpen && sortedChannels.length > 0 && (
            <div className="mt-0.5">
              {sortedChannels.map((channel) => {
                const unread = unreadCountForChannel(
                  { readState: readStates } as Parameters<typeof unreadCountForChannel>[0],
                  channel.id,
                );

                return (
                  <ChannelRow
                    key={channel.id}
                    name={channel.name}
                    visibility={channel.visibility}
                    unreadCount={unread}
                    onClick={() =>
                      navigate({
                        to: "/$orgSlug/c/$channelId",
                        params: { orgSlug, channelId: channel.id },
                      })
                    }
                  />
                );
              })}

              <button
                onClick={() => setChannelDialogOpen(true)}
                className="flex w-full items-center gap-2 px-4 py-1.5 text-sm text-sidebar-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
              >
                <Plus className="h-4 w-4" />
                New Channel
              </button>
            </div>
          )}

          <Separator className="my-2 bg-sidebar-border" />

          {/* DMs section */}
          <button
            onClick={() => setDmsOpen(!dmsOpen)}
            className="flex w-full items-center gap-1 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-sidebar-muted-foreground hover:text-sidebar-foreground transition-colors"
          >
            {dmsOpen ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            <MessageSquare className="h-3 w-3" />
            Direct Messages
          </button>

          {dmsOpen && (
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

                return (
                  <button
                    key={dm.id}
                    onClick={() =>
                      navigate({
                        to: "/$orgSlug/dm/$dmId",
                        params: { orgSlug, dmId: dm.id },
                      })
                    }
                    className="group flex w-full items-center gap-2 px-4 py-1.5 text-sm hover:bg-sidebar-accent transition-colors"
                  >
                    <Avatar size="xs" presence={userPresence}>
                      {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={displayName} />}
                      <AvatarFallback className="text-[8px]">{initials}</AvatarFallback>
                    </Avatar>
                    <span
                      className={`truncate ${unread > 0 ? "font-semibold text-sidebar-foreground" : "text-sidebar-muted-foreground group-hover:text-sidebar-foreground"}`}
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
                onClick={() => setDmDialogOpen(true)}
                className="flex w-full items-center gap-2 px-4 py-1.5 text-sm text-sidebar-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
              >
                <Plus className="h-4 w-4" />
                New Message
              </button>
            </div>
          )}
        </div>
      </ScrollArea>

      <CreateChannelDialog
        open={channelDialogOpen}
        onOpenChange={setChannelDialogOpen}
        onCreated={(channelId) => {
          setChannelDialogOpen(false);
          navigate({
            to: "/$orgSlug/c/$channelId",
            params: { orgSlug, channelId },
          });
        }}
        mutate={mutate}
        api={app.api}
        token={app.token}
        orgId={app.orgId}
      />

      <NewMessageDialog
        open={dmDialogOpen}
        onOpenChange={setDmDialogOpen}
        onCreated={(dmId) => {
          setDmDialogOpen(false);
          app.syncDirects();
          navigate({
            to: "/$orgSlug/dm/$dmId",
            params: { orgSlug, dmId },
          });
        }}
        api={app.api}
        token={app.token}
        orgId={app.orgId}
      />
    </div>
  );
}

function ChannelRow({
  name,
  visibility,
  unreadCount,
  onClick,
}: {
  name: string;
  visibility: "public" | "private";
  unreadCount: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-2 px-4 py-1.5 text-sm hover:bg-sidebar-accent transition-colors"
    >
      {visibility === "private" ? (
        <Lock className="h-4 w-4 shrink-0 text-sidebar-muted-foreground" />
      ) : (
        <Hash className="h-4 w-4 shrink-0 text-sidebar-muted-foreground" />
      )}
      <span
        className={`truncate ${unreadCount > 0 ? "font-semibold text-sidebar-foreground" : "text-sidebar-muted-foreground group-hover:text-sidebar-foreground"}`}
      >
        {name}
      </span>
      {unreadCount > 0 && (
        <Badge variant="accent" size="sm" className="ml-auto shrink-0">
          {unreadCount}
        </Badge>
      )}
    </button>
  );
}

function CreateChannelDialog({
  open,
  onOpenChange,
  onCreated,
  mutate,
  api,
  token,
  orgId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (channelId: string) => void;
  mutate: (name: "channelCreate", input: { id: string; name: string; topic?: string | null; visibility?: "public" | "private" }) => void;
  api: { channelCreate: (token: string, orgId: string, input: { name: string; topic?: string | null; visibility?: "public" | "private" }) => Promise<{ channel: { id: string } }> };
  token: string;
  orgId: string;
}) {
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const { channel } = await api.channelCreate(token, orgId, {
        name: name.trim(),
        topic: topic.trim() || null,
        visibility: "public",
      });
      onCreated(channel.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create channel");
      setLoading(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setName("");
      setTopic("");
      setError(null);
    }
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">Create Channel</DialogTitle>
          <DialogDescription>
            Add a new channel to your workspace
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="channel-name" className="text-sm font-medium">
              Channel name
            </label>
            <Input
              id="channel-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="general"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="channel-topic" className="text-sm font-medium">
              Topic (optional)
            </label>
            <Input
              id="channel-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="What's this channel about?"
              disabled={loading}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type MemberItem = {
  id: string;
  kind: "human" | "ai";
  username: string;
  firstName: string;
  lastName: string | null;
  avatarUrl: string | null;
};

function NewMessageDialog({
  open,
  onOpenChange,
  onCreated,
  api,
  token,
  orgId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (dmId: string) => void;
  api: ApiClient;
  token: string;
  orgId: string;
}) {
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    api
      .organizationMembers(token, orgId)
      .then((result) => {
        setMembers(
          result.members.map((m) => ({
            id: m.id,
            kind: m.kind,
            username: m.username,
            firstName: m.firstName,
            lastName: m.lastName,
            avatarUrl: m.avatarUrl,
          })),
        );
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load members");
      })
      .finally(() => setLoading(false));
  }, [open, api, token, orgId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return members;
    const q = search.toLowerCase();
    return members.filter(
      (m) =>
        m.firstName.toLowerCase().includes(q) ||
        (m.lastName?.toLowerCase().includes(q) ?? false) ||
        m.username.toLowerCase().includes(q),
    );
  }, [members, search]);

  async function handleSelect(userId: string) {
    setCreating(true);
    setError(null);
    try {
      const result = await api.directCreate(token, orgId, { userId });
      onCreated(result.channel.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create conversation");
      setCreating(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setSearch("");
      setError(null);
      setCreating(false);
    }
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">New Message</DialogTitle>
          <DialogDescription>
            Select a member to start a conversation
          </DialogDescription>
        </DialogHeader>

        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search members..."
          disabled={creating}
        />

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="max-h-64 overflow-y-auto">
          {loading ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Loading members...</p>
          ) : filtered.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No members found</p>
          ) : (
            filtered.map((member) => {
              const displayName = member.lastName
                ? `${member.firstName} ${member.lastName}`
                : member.firstName;
              const initials = (member.firstName[0] ?? "") + (member.lastName?.[0] ?? "");

              return (
                <button
                  key={member.id}
                  onClick={() => handleSelect(member.id)}
                  disabled={creating}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors disabled:opacity-50"
                >
                  <Avatar size="sm">
                    {member.avatarUrl && <AvatarImage src={member.avatarUrl} alt={displayName} />}
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="text-left">
                    <p className="font-medium">{displayName}</p>
                    <p className="text-xs text-muted-foreground">@{member.username}</p>
                  </div>
                  {member.kind === "ai" && (
                    <Badge variant="neutral" size="sm" className="ml-auto">
                      Bot
                    </Badge>
                  )}
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
