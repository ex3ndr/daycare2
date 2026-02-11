import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useApp, useStorage } from "@/app/sync/AppContext";
import { unreadCountForChannel } from "@/app/sync/selectors";
import { useUiStore } from "@/app/stores/uiStoreContext";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Separator } from "@/app/components/ui/separator";
import { Input } from "@/app/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/app/components/ui/dialog";
import { Hash, Lock, Plus, MessageSquare, ChevronDown, ChevronRight } from "lucide-react";

export function Sidebar() {
  const navigate = useNavigate();
  const app = useApp();
  const orgName = useStorage((s) => s.objects.context.orgName);
  const orgSlug = useStorage((s) => s.objects.context.orgSlug);
  const orgId = useStorage((s) => s.objects.context.orgId);
  const channelMap = useStorage((s) => s.objects.channel);
  const readStates = useStorage((s) => s.objects.readState);
  const mutate = useStorage((s) => s.mutate);
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);

  const channels = useMemo(
    () => Object.values(channelMap).filter((ch) => ch.organizationId === orgId),
    [channelMap, orgId],
  );

  const [channelsOpen, setChannelsOpen] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const sortedChannels = [...channels].sort((a, b) => a.name.localeCompare(b.name));

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

          {channelsOpen && (
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
                onClick={() => setDialogOpen(true)}
                className="flex w-full items-center gap-2 px-4 py-1.5 text-sm text-sidebar-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
              >
                <Plus className="h-4 w-4" />
                New Channel
              </button>
            </div>
          )}

          <Separator className="my-2 bg-sidebar-border" />

          {/* DMs section placeholder */}
          <div className="flex items-center gap-1 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-sidebar-muted-foreground">
            <MessageSquare className="h-3 w-3" />
            Direct Messages
          </div>
          <p className="px-4 py-2 text-xs text-sidebar-muted-foreground">
            No direct messages yet
          </p>
        </div>
      </ScrollArea>

      <CreateChannelDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(channelId) => {
          setDialogOpen(false);
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
