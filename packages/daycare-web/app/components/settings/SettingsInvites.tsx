import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "@/app/sync/AppContext";
import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { Search, Mail, X } from "lucide-react";
import { toastAdd } from "@/app/stores/toastStoreContext";
import type { OrgInvite } from "@/app/daycare/types";

type SettingsInvitesProps = {
  isOwner: boolean;
};

function getInviteStatus(invite: OrgInvite): "pending" | "accepted" | "revoked" | "expired" {
  if (invite.revokedAt) return "revoked";
  if (invite.acceptedAt) return "accepted";
  if (invite.expired || invite.expiresAt < Date.now()) return "expired";
  return "pending";
}

const STATUS_CONFIG: Record<
  "pending" | "accepted" | "revoked" | "expired",
  { label: string; variant: "accent" | "success" | "danger" | "neutral" }
> = {
  pending: { label: "Pending", variant: "accent" },
  accepted: { label: "Accepted", variant: "success" },
  revoked: { label: "Revoked", variant: "danger" },
  expired: { label: "Expired", variant: "neutral" },
};

function formatTimeRemaining(expiresAt: number): string {
  const remaining = expiresAt - Date.now();
  if (remaining <= 0) return "Expired";
  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d remaining`;
  if (hours > 0) return `${hours}h remaining`;
  const minutes = Math.floor(remaining / (1000 * 60));
  return `${minutes}m remaining`;
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function SettingsInvites({ isOwner }: SettingsInvitesProps) {
  const app = useApp();

  const [invites, setInvites] = useState<OrgInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Invite form
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  // Revoke confirmation
  const [revokeTarget, setRevokeTarget] = useState<OrgInvite | null>(null);

  const loadInvites = useCallback(() => {
    setLoading(true);
    setError(null);
    app.api
      .orgInviteList(app.token, app.orgId)
      .then(({ invites: list }) => setInvites(list))
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load invites");
      })
      .finally(() => setLoading(false));
  }, [app]);

  useEffect(() => {
    loadInvites();
  }, [loadInvites]);

  // Split into pending and past, with search filtering
  const { pending, past } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? invites.filter((inv) => inv.email.toLowerCase().includes(q))
      : invites;

    const pendingList: OrgInvite[] = [];
    const pastList: OrgInvite[] = [];

    for (const inv of filtered) {
      if (getInviteStatus(inv) === "pending") {
        pendingList.push(inv);
      } else {
        pastList.push(inv);
      }
    }

    return { pending: pendingList, past: pastList };
  }, [invites, search]);

  const handleSendInvite = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = email.trim();
      if (!trimmed) return;

      setSending(true);
      try {
        const { invite } = await app.api.orgInviteCreate(app.token, app.orgId, { email: trimmed });
        setInvites((prev) => [invite, ...prev]);
        setEmail("");
        toastAdd(`Invite sent to ${trimmed}`, "success");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to send invite";
        toastAdd(msg, "error");
      } finally {
        setSending(false);
      }
    },
    [app, email],
  );

  const handleRevoke = useCallback(
    async (invite: OrgInvite) => {
      try {
        const { invite: updated } = await app.api.orgInviteRevoke(app.token, app.orgId, invite.id);
        setInvites((prev) =>
          prev.map((inv) =>
            inv.id === invite.id ? { ...inv, revokedAt: updated.revokedAt } : inv,
          ),
        );
        setRevokeTarget(null);
        toastAdd(`Invite to ${invite.email} revoked`, "success");
      } catch (err) {
        toastAdd(err instanceof Error ? err.message : "Failed to revoke invite", "error");
      }
    },
    [app],
  );

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Invites</h2>

      {/* Send invite form (owner only) */}
      {isOwner && (
        <form onSubmit={handleSendInvite} className="flex gap-2 mb-6">
          <div className="flex-1 relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="pl-9"
              disabled={sending}
            />
          </div>
          <Button type="submit" disabled={sending || !email.trim()}>
            {sending ? "Sending..." : "Send Invite"}
          </Button>
        </form>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search invites by email..."
          className="pl-9"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="text-sm text-destructive mb-4">
          {error}{" "}
          <button onClick={loadInvites} className="underline">
            Retry
          </button>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <p className="text-muted-foreground text-sm py-8 text-center">Loading invites...</p>
      ) : pending.length === 0 && past.length === 0 ? (
        <p className="text-muted-foreground text-sm py-8 text-center">
          {search.trim() ? "No invites match your search" : "No invites yet"}
        </p>
      ) : (
        <ScrollArea className="max-h-[60vh]">
          {/* Pending section */}
          {pending.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">
                Pending ({pending.length})
              </h3>
              <div className="space-y-1">
                {pending.map((invite) => (
                  <InviteRow
                    key={invite.id}
                    invite={invite}
                    isOwner={isOwner}
                    onRevokeClick={() => setRevokeTarget(invite)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Past section */}
          {past.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">
                Past ({past.length})
              </h3>
              <div className="space-y-1">
                {past.map((invite) => (
                  <InviteRow
                    key={invite.id}
                    invite={invite}
                    isOwner={isOwner}
                    onRevokeClick={() => {}}
                  />
                ))}
              </div>
            </div>
          )}
        </ScrollArea>
      )}

      <p className="text-xs text-muted-foreground mt-4">
        {invites.length} invite{invites.length !== 1 ? "s" : ""} total
      </p>

      {/* Revoke confirmation dialog */}
      <RevokeConfirmDialog
        invite={revokeTarget}
        onConfirm={handleRevoke}
        onCancel={() => setRevokeTarget(null)}
      />
    </div>
  );
}

function InviteRow({
  invite,
  isOwner,
  onRevokeClick,
}: {
  invite: OrgInvite;
  isOwner: boolean;
  onRevokeClick: () => void;
}) {
  const status = getInviteStatus(invite);
  const config = STATUS_CONFIG[status];

  return (
    <div className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent/50 transition-colors">
      <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted shrink-0">
        <Mail className="h-4 w-4 text-muted-foreground" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{invite.email}</p>
        <p className="text-xs text-muted-foreground">
          Sent {formatDate(invite.createdAt)}
          {status === "pending" && <> &middot; {formatTimeRemaining(invite.expiresAt)}</>}
          {status === "accepted" && invite.acceptedAt && (
            <> &middot; Accepted {formatDate(invite.acceptedAt)}</>
          )}
          {status === "revoked" && invite.revokedAt && (
            <> &middot; Revoked {formatDate(invite.revokedAt)}</>
          )}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Badge variant={config.variant} size="sm">
          {config.label}
        </Badge>

        {isOwner && status === "pending" && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={onRevokeClick}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

function RevokeConfirmDialog({
  invite,
  onConfirm,
  onCancel,
}: {
  invite: OrgInvite | null;
  onConfirm: (invite: OrgInvite) => void;
  onCancel: () => void;
}) {
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    if (!invite) return;
    setLoading(true);
    try {
      await onConfirm(invite);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={invite !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Revoke invite</DialogTitle>
          <DialogDescription>
            Are you sure you want to revoke the invite to{" "}
            <span className="font-medium text-foreground">{invite?.email}</span>? They will no
            longer be able to join using this invite.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={loading}>
            {loading ? "Revoking..." : "Revoke"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
