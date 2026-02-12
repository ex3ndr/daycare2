import { useEffect, useMemo, useState } from "react";
import { Input } from "@/app/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar";
import { Badge } from "@/app/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/app/components/ui/dialog";
import type { ApiClient } from "@/app/daycare/api/apiClientCreate";

type MemberItem = {
  id: string;
  kind: "human" | "ai";
  username: string;
  firstName: string;
  lastName: string | null;
  avatarUrl: string | null;
};

export function SidebarNewMessageDialog({
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
