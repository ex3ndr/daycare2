import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "@/app/sync/AppContext";
import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { Globe, X } from "lucide-react";
import { toastAdd } from "@/app/stores/toastStoreContext";
import type { OrgDomain, User } from "@/app/daycare/types";

type SettingsDomainsProps = {
  isOwner: boolean;
};

function isValidDomain(value: string): boolean {
  if (!value || value.includes("@") || value.includes(" ")) return false;
  // Basic domain format: at least one dot, no leading/trailing dots or hyphens
  const pattern = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
  return pattern.test(value);
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function SettingsDomains({ isOwner }: SettingsDomainsProps) {
  const app = useApp();

  const [domains, setDomains] = useState<OrgDomain[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add domain form
  const [domainInput, setDomainInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Remove confirmation
  const [removeTarget, setRemoveTarget] = useState<OrgDomain | null>(null);

  const loadDomains = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      app.api.orgDomainList(app.token, app.orgId),
      app.api.organizationMembers(app.token, app.orgId),
    ])
      .then(([domainRes, memberRes]) => {
        setDomains(domainRes.domains);
        setMembers(memberRes.members);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load domains");
      })
      .finally(() => setLoading(false));
  }, [app]);

  useEffect(() => {
    loadDomains();
  }, [loadDomains]);

  // Member lookup by ID for "added by" display
  const memberById = useMemo(() => {
    const map = new Map<string, User>();
    for (const m of members) {
      map.set(m.id, m);
    }
    return map;
  }, [members]);

  const handleDomainInputChange = useCallback((value: string) => {
    const normalized = value.toLowerCase().trim();
    setDomainInput(value);
    if (!normalized) {
      setValidationError(null);
    } else if (normalized.includes("@")) {
      setValidationError("Enter a domain without @");
    } else if (normalized.includes(" ")) {
      setValidationError("Domain cannot contain spaces");
    } else if (!isValidDomain(normalized)) {
      setValidationError("Invalid domain format (e.g. example.com)");
    } else {
      setValidationError(null);
    }
  }, []);

  const handleAddDomain = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const normalized = domainInput.toLowerCase().trim();
      if (!normalized || !isValidDomain(normalized)) return;

      setAdding(true);
      try {
        const { domain } = await app.api.orgDomainAdd(app.token, app.orgId, { domain: normalized });
        setDomains((prev) => [domain, ...prev]);
        setDomainInput("");
        setValidationError(null);
        toastAdd(`Domain ${normalized} added`, "success");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to add domain";
        toastAdd(msg, "error");
      } finally {
        setAdding(false);
      }
    },
    [app, domainInput],
  );

  const handleRemove = useCallback(
    async (domain: OrgDomain) => {
      try {
        await app.api.orgDomainRemove(app.token, app.orgId, domain.id);
        setDomains((prev) => prev.filter((d) => d.id !== domain.id));
        setRemoveTarget(null);
        toastAdd(`Domain ${domain.domain} removed`, "success");
      } catch (err) {
        toastAdd(err instanceof Error ? err.message : "Failed to remove domain", "error");
      }
    },
    [app],
  );

  return (
    <div>
      <h2 className="text-xl font-semibold mb-1">Domains</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Users with email addresses matching these domains can join this organization automatically.
      </p>

      {/* Add domain form (owner only) */}
      {isOwner && (
        <form onSubmit={handleAddDomain} className="mb-6">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                value={domainInput}
                onChange={(e) => handleDomainInputChange(e.target.value)}
                placeholder="example.com"
                className="pl-9"
                disabled={adding}
              />
            </div>
            <Button
              type="submit"
              disabled={adding || !domainInput.trim() || !!validationError}
            >
              {adding ? "Adding..." : "Add Domain"}
            </Button>
          </div>
          {validationError && (
            <p className="text-xs text-destructive mt-1">{validationError}</p>
          )}
        </form>
      )}

      {/* Error */}
      {error && (
        <div className="text-sm text-destructive mb-4">
          {error}{" "}
          <button onClick={loadDomains} className="underline">
            Retry
          </button>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <p className="text-muted-foreground text-sm py-8 text-center">Loading domains...</p>
      ) : domains.length === 0 ? (
        <p className="text-muted-foreground text-sm py-8 text-center">
          No domains configured yet
        </p>
      ) : (
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-1">
            {domains.map((domain) => {
              const addedBy = memberById.get(domain.createdByUserId);
              return (
                <DomainRow
                  key={domain.id}
                  domain={domain}
                  addedByName={
                    addedBy
                      ? `${addedBy.firstName}${addedBy.lastName ? ` ${addedBy.lastName}` : ""}`
                      : undefined
                  }
                  isOwner={isOwner}
                  onRemoveClick={() => setRemoveTarget(domain)}
                />
              );
            })}
          </div>
        </ScrollArea>
      )}

      <p className="text-xs text-muted-foreground mt-4">
        {domains.length} domain{domains.length !== 1 ? "s" : ""} configured
      </p>

      {/* Remove confirmation dialog */}
      <RemoveConfirmDialog
        domain={removeTarget}
        onConfirm={handleRemove}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  );
}

function DomainRow({
  domain,
  addedByName,
  isOwner,
  onRemoveClick,
}: {
  domain: OrgDomain;
  addedByName: string | undefined;
  isOwner: boolean;
  onRemoveClick: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent/50 transition-colors">
      <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted shrink-0">
        <Globe className="h-4 w-4 text-muted-foreground" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{domain.domain}</p>
        <p className="text-xs text-muted-foreground">
          Added {formatDate(domain.createdAt)}
          {addedByName && <> by {addedByName}</>}
        </p>
      </div>

      {isOwner && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
          onClick={onRemoveClick}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

function RemoveConfirmDialog({
  domain,
  onConfirm,
  onCancel,
}: {
  domain: OrgDomain | null;
  onConfirm: (domain: OrgDomain) => void;
  onCancel: () => void;
}) {
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    if (!domain) return;
    setLoading(true);
    try {
      await onConfirm(domain);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={domain !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Remove domain</DialogTitle>
          <DialogDescription>
            Are you sure you want to remove{" "}
            <span className="font-medium text-foreground">{domain?.domain}</span>? Users with
            this email domain will no longer be able to auto-join this organization.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={loading}>
            {loading ? "Removing..." : "Remove"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
