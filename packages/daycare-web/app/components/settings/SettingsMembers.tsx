import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp, useStorage } from "@/app/sync/AppContext";
import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { Search, MoreVertical, Shield, UserX, UserCheck } from "lucide-react";
import { toastAdd } from "@/app/stores/toastStoreContext";
import type { User } from "@/app/daycare/types";

type SettingsMembersProps = {
  isOwner: boolean;
};

export function SettingsMembers({ isOwner }: SettingsMembersProps) {
  const app = useApp();

  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Deactivation confirmation dialog
  const [confirmTarget, setConfirmTarget] = useState<User | null>(null);

  const currentUserId = useStorage((s) => s.objects.context.userId);

  const loadMembers = useCallback(() => {
    setLoading(true);
    setError(null);
    app.api
      .organizationMembers(app.token, app.orgId)
      .then(({ members: m }) => setMembers(m))
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load members");
      })
      .finally(() => setLoading(false));
  }, [app]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const filtered = useMemo(() => {
    if (!search.trim()) return members;
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      const full = `${m.firstName} ${m.lastName ?? ""}`.toLowerCase();
      return full.includes(q) || m.username.toLowerCase().includes(q);
    });
  }, [members, search]);

  // Actions
  const handleRoleChange = useCallback(
    async (userId: string, role: "OWNER" | "MEMBER") => {
      try {
        await app.api.orgMemberRoleSet(app.token, app.orgId, userId, { role });
        setMembers((prev) =>
          prev.map((m) =>
            m.id === userId ? { ...m, orgRole: role.toLowerCase() as "owner" | "member" } : m,
          ),
        );
        toastAdd(`Role updated to ${role.toLowerCase()}`, "success");
      } catch (err) {
        toastAdd(err instanceof Error ? err.message : "Failed to update role", "error");
      }
    },
    [app],
  );

  const handleDeactivate = useCallback(
    async (user: User) => {
      try {
        await app.api.orgMemberDeactivate(app.token, app.orgId, user.id);
        setMembers((prev) =>
          prev.map((m) => (m.id === user.id ? { ...m, deactivatedAt: Date.now() } : m)),
        );
        setConfirmTarget(null);
        toastAdd(`${user.firstName} has been deactivated`, "success");
      } catch (err) {
        toastAdd(err instanceof Error ? err.message : "Failed to deactivate member", "error");
      }
    },
    [app],
  );

  const handleReactivate = useCallback(
    async (user: User) => {
      try {
        await app.api.orgMemberReactivate(app.token, app.orgId, user.id);
        setMembers((prev) =>
          prev.map((m) => (m.id === user.id ? { ...m, deactivatedAt: null } : m)),
        );
        toastAdd(`${user.firstName} has been reactivated`, "success");
      } catch (err) {
        toastAdd(err instanceof Error ? err.message : "Failed to reactivate member", "error");
      }
    },
    [app],
  );

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Members</h2>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search members..."
          className="pl-9"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="text-sm text-destructive mb-4">
          {error}{" "}
          <button onClick={loadMembers} className="underline">
            Retry
          </button>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <p className="text-muted-foreground text-sm py-8 text-center">Loading members...</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground text-sm py-8 text-center">
          {search.trim() ? "No members match your search" : "No members found"}
        </p>
      ) : (
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-1">
            {filtered.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                isOwner={isOwner}
                isSelf={member.id === currentUserId}
                onRoleChange={handleRoleChange}
                onDeactivateClick={() => setConfirmTarget(member)}
                onReactivate={() => handleReactivate(member)}
              />
            ))}
          </div>
        </ScrollArea>
      )}

      <p className="text-xs text-muted-foreground mt-4">
        {members.length} member{members.length !== 1 ? "s" : ""} total
      </p>

      {/* Deactivation confirmation dialog */}
      <DeactivateConfirmDialog
        user={confirmTarget}
        onConfirm={handleDeactivate}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
}

function MemberRow({
  member,
  isOwner,
  isSelf,
  onRoleChange,
  onDeactivateClick,
  onReactivate,
}: {
  member: User;
  isOwner: boolean;
  isSelf: boolean;
  onRoleChange: (userId: string, role: "OWNER" | "MEMBER") => void;
  onDeactivateClick: () => void;
  onReactivate: () => void;
}) {
  const displayName = member.lastName
    ? `${member.firstName} ${member.lastName}`
    : member.firstName;
  const initials = (member.firstName[0] ?? "") + (member.lastName?.[0] ?? "");
  const isDeactivated = member.deactivatedAt !== null && member.deactivatedAt !== undefined;
  const role = member.orgRole ?? "member";

  return (
    <div
      className={`flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent/50 transition-colors ${isDeactivated ? "opacity-50" : ""}`}
    >
      <Avatar size="sm">
        {member.avatarUrl && <AvatarImage src={member.avatarUrl} alt={displayName} />}
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{displayName}</p>
          {isSelf && (
            <span className="text-xs text-muted-foreground">(you)</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">@{member.username}</p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {role === "owner" && (
          <Badge variant="accent" size="sm">
            Owner
          </Badge>
        )}
        {member.kind === "ai" && (
          <Badge variant="neutral" size="sm">
            Bot
          </Badge>
        )}
        {isDeactivated && (
          <Badge variant="danger" size="sm">
            Deactivated
          </Badge>
        )}

        {/* Owner actions on other members */}
        {isOwner && !isSelf && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {role === "member" ? (
                <DropdownMenuItem onClick={() => onRoleChange(member.id, "OWNER")}>
                  <Shield className="h-4 w-4 mr-2" />
                  Make Owner
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => onRoleChange(member.id, "MEMBER")}>
                  <Shield className="h-4 w-4 mr-2" />
                  Remove Owner
                </DropdownMenuItem>
              )}
              {isDeactivated ? (
                <DropdownMenuItem onClick={onReactivate}>
                  <UserCheck className="h-4 w-4 mr-2" />
                  Reactivate
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={onDeactivateClick}
                  className="text-destructive focus:text-destructive"
                >
                  <UserX className="h-4 w-4 mr-2" />
                  Deactivate
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}

function DeactivateConfirmDialog({
  user,
  onConfirm,
  onCancel,
}: {
  user: User | null;
  onConfirm: (user: User) => void;
  onCancel: () => void;
}) {
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    if (!user) return;
    setLoading(true);
    try {
      await onConfirm(user);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={user !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Deactivate member</DialogTitle>
          <DialogDescription>
            Are you sure you want to deactivate{" "}
            <span className="font-medium text-foreground">
              {user?.firstName} {user?.lastName ?? ""}
            </span>
            ? They will lose access to this organization.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={loading}>
            {loading ? "Deactivating..." : "Deactivate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
