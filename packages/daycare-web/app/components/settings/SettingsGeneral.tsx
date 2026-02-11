import { useState, useEffect } from "react";
import { useApp, useStorage } from "@/app/sync/AppContext";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Separator } from "@/app/components/ui/separator";
import { toastAdd } from "@/app/stores/toastStoreContext";
import type { Organization } from "@/app/daycare/types";

type SettingsGeneralProps = {
  isOwner: boolean;
};

export function SettingsGeneral({ isOwner }: SettingsGeneralProps) {
  const app = useApp();
  const orgSlug = useStorage((s) => s.objects.context.orgSlug);
  const orgName = useStorage((s) => s.objects.context.orgName);

  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    app.api
      .organizationGet(app.token, app.orgId)
      .then(({ organization }) => {
        setOrg(organization);
        setName(organization.name);
        setAvatarUrl(organization.avatarUrl ?? "");
      })
      .catch(() => {
        // Fall back to context data
        setName(orgName);
      })
      .finally(() => setLoading(false));
  }, [app, orgName]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    setSaving(true);
    setSaveError(null);

    try {
      const { organization } = await app.api.organizationUpdate(app.token, app.orgId, {
        name: trimmedName,
        avatarUrl: avatarUrl.trim() || null,
      });
      setOrg(organization);
      toastAdd("Organization updated", "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update organization";
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  }

  const hasChanges =
    name.trim() !== (org?.name ?? orgName) ||
    (avatarUrl.trim() || null) !== (org?.avatarUrl ?? null);

  if (loading) {
    return <p className="text-muted-foreground text-sm">Loading...</p>;
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6">General</h2>

      {/* Read-only info */}
      <div className="space-y-4 mb-6">
        <div>
          <label className="text-sm font-medium text-muted-foreground">Slug</label>
          <p className="text-sm mt-0.5">{org?.slug ?? orgSlug}</p>
        </div>
      </div>

      <Separator className="mb-6" />

      {/* Editable form (owner) or read-only display (member) */}
      {isOwner ? (
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="org-name" className="text-sm font-medium">
              Organization name
            </label>
            <Input
              id="org-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Organization"
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="org-avatar" className="text-sm font-medium">
              Avatar URL
            </label>
            <Input
              id="org-avatar"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/avatar.png"
              disabled={saving}
            />
            <p className="text-xs text-muted-foreground">
              Optional image URL for the organization avatar
            </p>
          </div>

          {saveError && <p className="text-sm text-destructive">{saveError}</p>}

          <Button type="submit" disabled={saving || !name.trim() || !hasChanges}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </form>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Name</label>
            <p className="text-sm mt-0.5">{org?.name ?? orgName}</p>
          </div>
          {org?.avatarUrl && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Avatar</label>
              <p className="text-sm mt-0.5 truncate">{org.avatarUrl}</p>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Only organization owners can edit these settings.
          </p>
        </div>
      )}
    </div>
  );
}
