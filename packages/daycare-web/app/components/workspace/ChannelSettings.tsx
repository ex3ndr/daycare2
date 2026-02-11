import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Badge } from "@/app/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar";
import { Separator } from "@/app/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import { Hash, Lock, Archive, ArchiveRestore, Bell, UserMinus, Shield, ChevronDown } from "lucide-react";
import type { ApiClient } from "@/app/daycare/api/apiClientCreate";
import type { User, ChannelMember } from "@/app/daycare/types";
import { cn } from "@/app/lib/utils";

type Tab = "overview" | "members";

type NotificationSetting = "ALL" | "MENTIONS_ONLY" | "MUTED";

const NOTIFICATION_LABELS: Record<NotificationSetting, string> = {
  ALL: "All messages",
  MENTIONS_ONLY: "Mentions only",
  MUTED: "Muted",
};

type ChannelSettingsProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelId: string;
  channelName: string;
  channelTopic: string | null;
  channelVisibility: "public" | "private";
  currentUserId: string;
  api: ApiClient;
  token: string;
  orgId: string;
  onChannelUpdated?: () => void;
};

export function ChannelSettings({
  open,
  onOpenChange,
  channelId,
  channelName,
  channelTopic,
  channelVisibility,
  currentUserId,
  api,
  token,
  orgId,
  onChannelUpdated,
}: ChannelSettingsProps) {
  const [tab, setTab] = useState<Tab>("overview");

  // Overview form state
  const [name, setName] = useState(channelName);
  const [topic, setTopic] = useState(channelTopic ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Members state
  const [members, setMembers] = useState<Array<ChannelMember & { user: User }>>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);

  // Notification state
  const [notifSetting, setNotifSetting] = useState<NotificationSetting>("ALL");
  const [notifSaving, setNotifSaving] = useState(false);

  // Archive state
  const [archiveLoading, setArchiveLoading] = useState(false);

  // Current user's role in this channel
  const currentUserRole = useMemo(
    () => members.find((m) => m.userId === currentUserId)?.role ?? "member",
    [members, currentUserId],
  );
  const isOwner = currentUserRole === "owner";

  // Reset form when dialog opens/channel changes
  useEffect(() => {
    if (open) {
      setName(channelName);
      setTopic(channelTopic ?? "");
      setSaveError(null);
      setTab("overview");
    }
  }, [open, channelName, channelTopic]);

  // Load members when members tab is selected or dialog opens
  useEffect(() => {
    if (!open) return;
    loadMembers();
  }, [open, channelId]);

  function loadMembers() {
    setMembersLoading(true);
    setMembersError(null);
    api
      .channelMembers(token, orgId, channelId)
      .then((result) => {
        setMembers(result.members);
      })
      .catch((err) => {
        setMembersError(err instanceof Error ? err.message : "Failed to load members");
      })
      .finally(() => setMembersLoading(false));
  }

  // Save overview changes
  async function handleSaveOverview(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    setSaving(true);
    setSaveError(null);

    try {
      await api.channelUpdate(token, orgId, channelId, {
        name: trimmedName,
        topic: topic.trim() || null,
      });
      onChannelUpdated?.();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to update channel");
    } finally {
      setSaving(false);
    }
  }

  // Archive / unarchive
  const handleArchive = useCallback(async () => {
    setArchiveLoading(true);
    try {
      await api.channelArchive(token, orgId, channelId);
      onChannelUpdated?.();
      onOpenChange(false);
    } catch {
      // Non-critical, silently ignore
    } finally {
      setArchiveLoading(false);
    }
  }, [api, token, orgId, channelId, onChannelUpdated, onOpenChange]);

  const handleUnarchive = useCallback(async () => {
    setArchiveLoading(true);
    try {
      await api.channelUnarchive(token, orgId, channelId);
      onChannelUpdated?.();
    } catch {
      // Non-critical
    } finally {
      setArchiveLoading(false);
    }
  }, [api, token, orgId, channelId, onChannelUpdated]);

  // Notification setting change
  const handleNotifChange = useCallback(
    async (setting: NotificationSetting) => {
      setNotifSaving(true);
      try {
        await api.channelNotificationsUpdate(token, orgId, channelId, { setting });
        setNotifSetting(setting);
      } catch {
        // Non-critical
      } finally {
        setNotifSaving(false);
      }
    },
    [api, token, orgId, channelId],
  );

  // Kick member
  const handleKick = useCallback(
    async (userId: string) => {
      try {
        await api.channelMemberKick(token, orgId, channelId, userId);
        setMembers((prev) => prev.filter((m) => m.userId !== userId));
      } catch {
        // Non-critical
      }
    },
    [api, token, orgId, channelId],
  );

  // Change member role
  const handleRoleChange = useCallback(
    async (userId: string, role: "owner" | "member") => {
      try {
        await api.channelMemberRoleUpdate(token, orgId, channelId, userId, { role });
        setMembers((prev) =>
          prev.map((m) => (m.userId === userId ? { ...m, role } : m)),
        );
      } catch {
        // Non-critical
      }
    },
    [api, token, orgId, channelId],
  );

  const hasOverviewChanges =
    name.trim() !== channelName || (topic.trim() || null) !== (channelTopic ?? null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            {channelVisibility === "private" ? (
              <Lock className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Hash className="h-4 w-4 text-muted-foreground" />
            )}
            Channel Settings
          </DialogTitle>
          <DialogDescription>{channelName}</DialogDescription>
        </DialogHeader>

        {/* Tab buttons */}
        <div className="flex gap-1 border-b">
          <TabButton active={tab === "overview"} onClick={() => setTab("overview")}>
            Overview
          </TabButton>
          <TabButton active={tab === "members"} onClick={() => setTab("members")}>
            Members ({members.length})
          </TabButton>
        </div>

        {/* Overview tab */}
        {tab === "overview" && (
          <form onSubmit={handleSaveOverview} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="settings-name" className="text-sm font-medium">
                Channel name
              </label>
              <Input
                id="settings-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="general"
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="settings-topic" className="text-sm font-medium">
                Topic
              </label>
              <Input
                id="settings-topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="What's this channel about?"
                disabled={saving}
              />
            </div>

            {saveError && <p className="text-sm text-destructive">{saveError}</p>}

            <DialogFooter>
              <Button
                type="submit"
                disabled={saving || !name.trim() || !hasOverviewChanges}
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>

            <Separator />

            {/* Notifications */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Bell className="h-4 w-4 text-muted-foreground" />
                Notifications
              </label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between" disabled={notifSaving}>
                    {NOTIFICATION_LABELS[notifSetting]}
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[200px]">
                  {(Object.keys(NOTIFICATION_LABELS) as NotificationSetting[]).map((key) => (
                    <DropdownMenuItem
                      key={key}
                      onClick={() => handleNotifChange(key)}
                      className={cn(key === notifSetting && "font-semibold")}
                    >
                      {NOTIFICATION_LABELS[key]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Archive (owner only) */}
            {isOwner && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="destructive"
                    className="w-full"
                    disabled={archiveLoading}
                    onClick={handleArchive}
                  >
                    <Archive className="h-4 w-4 mr-2" />
                    {archiveLoading ? "Archiving..." : "Archive Channel"}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Archived channels are hidden and read-only.
                  </p>
                </div>
              </>
            )}
          </form>
        )}

        {/* Members tab */}
        {tab === "members" && (
          <div>
            {membersError && (
              <p className="text-sm text-destructive mb-2">{membersError}</p>
            )}
            {membersLoading ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Loading members...
              </p>
            ) : members.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No members found
              </p>
            ) : (
              <ScrollArea className="max-h-72">
                <div className="space-y-1">
                  {members.map((member) => (
                    <MemberRow
                      key={member.userId}
                      member={member}
                      isOwner={isOwner}
                      isSelf={member.userId === currentUserId}
                      onKick={() => handleKick(member.userId)}
                      onRoleChange={(role) =>
                        handleRoleChange(member.userId, role)
                      }
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function MemberRow({
  member,
  isOwner,
  isSelf,
  onKick,
  onRoleChange,
}: {
  member: ChannelMember & { user: User };
  isOwner: boolean;
  isSelf: boolean;
  onKick: () => void;
  onRoleChange: (role: "owner" | "member") => void;
}) {
  const user = member.user;
  const displayName = user.lastName
    ? `${user.firstName} ${user.lastName}`
    : user.firstName;
  const initials =
    (user.firstName[0] ?? "") + (user.lastName?.[0] ?? "");

  return (
    <div className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent/50 transition-colors">
      <Avatar size="sm">
        {user.avatarUrl && (
          <AvatarImage src={user.avatarUrl} alt={displayName} />
        )}
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{displayName}</p>
        <p className="text-xs text-muted-foreground">@{user.username}</p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {member.role === "owner" && (
          <Badge variant="accent" size="sm">
            Owner
          </Badge>
        )}
        {user.kind === "ai" && (
          <Badge variant="neutral" size="sm">
            Bot
          </Badge>
        )}

        {/* Owner actions on other members */}
        {isOwner && !isSelf && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {member.role === "member" ? (
                <DropdownMenuItem onClick={() => onRoleChange("owner")}>
                  <Shield className="h-4 w-4 mr-2" />
                  Make Owner
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => onRoleChange("member")}>
                  <Shield className="h-4 w-4 mr-2" />
                  Remove Owner
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={onKick}
                className="text-destructive focus:text-destructive"
              >
                <UserMinus className="h-4 w-4 mr-2" />
                Kick
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
