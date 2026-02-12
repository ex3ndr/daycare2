import { useState, useEffect } from "react";
import { useApp, useStorage } from "@/app/sync/AppContext";
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
import { Textarea } from "@/app/components/ui/textarea";
import { Loader2 } from "lucide-react";

type ProfileFields = {
  firstName: string;
  lastName: string;
  username: string;
  bio: string;
  timezone: string;
  avatarUrl: string;
};

export function WorkspaceProfileEditor({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const app = useApp();
  const orgId = useStorage((s) => s.objects.context.orgId);

  const [fields, setFields] = useState<ProfileFields>({
    firstName: "",
    lastName: "",
    username: "",
    bio: "",
    timezone: "",
    avatarUrl: "",
  });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch profile data when dialog opens — no hook abstraction for this API call
  useEffect(() => {
    if (!open) return;
    setFetching(true);
    setError(null);
    app.api
      .profileGet(app.token, orgId)
      .then(({ profile }) => {
        setFields({
          firstName: profile.firstName ?? "",
          lastName: profile.lastName ?? "",
          username: profile.username ?? "",
          bio: profile.bio ?? "",
          timezone: profile.timezone ?? "",
          avatarUrl: profile.avatarUrl ?? "",
        });
      })
      .catch(() => setError("Failed to load profile"))
      .finally(() => setFetching(false));
  }, [open, app, orgId]);

  function handleChange(key: keyof ProfileFields, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
    setError(null);
  }

  async function handleSave() {
    if (!fields.firstName.trim()) {
      setError("First name is required");
      return;
    }
    if (!fields.username.trim()) {
      setError("Username is required");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const patchData = {
        firstName: fields.firstName.trim(),
        lastName: fields.lastName.trim() || null,
        username: fields.username.trim(),
        bio: fields.bio.trim() || null,
        timezone: fields.timezone.trim() || null,
        avatarUrl: fields.avatarUrl.trim() || null,
      };
      await app.api.profilePatch(app.token, orgId, patchData);
      // Update sync context so messages/rail reflect new profile immediately
      app.engine.rebase({
        context: {
          username: patchData.username,
          firstName: patchData.firstName,
          lastName: patchData.lastName,
          avatarUrl: patchData.avatarUrl,
        },
      });
      app.storage.getState().updateObjects();
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save profile";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>Update your profile information.</DialogDescription>
        </DialogHeader>

        {fetching ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="profile-firstName">
                  First name
                </label>
                <Input
                  id="profile-firstName"
                  value={fields.firstName}
                  onChange={(e) => handleChange("firstName", e.target.value)}
                  placeholder="First name"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="profile-lastName">
                  Last name
                </label>
                <Input
                  id="profile-lastName"
                  value={fields.lastName}
                  onChange={(e) => handleChange("lastName", e.target.value)}
                  placeholder="Last name"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="profile-username">
                Username
              </label>
              <Input
                id="profile-username"
                value={fields.username}
                onChange={(e) => handleChange("username", e.target.value)}
                placeholder="username"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="profile-bio">
                Bio
              </label>
              <Textarea
                id="profile-bio"
                value={fields.bio}
                onChange={(e) => handleChange("bio", e.target.value)}
                placeholder="Tell others about yourself"
                rows={3}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="profile-timezone">
                Timezone
              </label>
              <Input
                id="profile-timezone"
                value={fields.timezone}
                onChange={(e) => handleChange("timezone", e.target.value)}
                placeholder="e.g. America/New_York"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="profile-avatarUrl">
                Avatar URL
              </label>
              <Input
                id="profile-avatarUrl"
                value={fields.avatarUrl}
                onChange={(e) => handleChange("avatarUrl", e.target.value)}
                placeholder="https://example.com/avatar.png"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || fetching}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
