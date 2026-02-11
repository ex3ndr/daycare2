import { useState, useEffect } from "react";
import { createRoute, redirect } from "@tanstack/react-router";
import { rootRoute } from "./__root";
import { guardAuthenticated } from "@/app/lib/routeGuard";
import { sessionGet, sessionSet } from "@/app/lib/sessionStore";
import { apiClientCreate, type ApiClient } from "@/app/daycare/api/apiClientCreate";
import type { Organization } from "@/app/daycare/types";
import { ApiError } from "@/app/daycare/api/apiRequest";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import {
  Card,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/app/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/app/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar";
import { Loader2, Plus, Building2, ChevronRight, LogIn } from "lucide-react";

const api = apiClientCreate("");

export const orgsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "orgs",
  beforeLoad: ({ context }) => {
    const result = guardAuthenticated(context.auth);
    if (result.redirect) {
      throw redirect({ to: result.redirect });
    }
  },
  component: OrgsPage,
});

type OrgsData = {
  myOrgs: Organization[];
  joinableOrgs: Organization[];
};

function OrgsPage() {
  const [data, setData] = useState<OrgsData>({ myOrgs: [], joinableOrgs: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    loadOrgsData(api, getToken()).then(
      (result) => {
        setData(result);
        setLoading(false);
      },
      (err) => {
        setError(err instanceof Error ? err.message : "Failed to load organizations");
        setLoading(false);
      },
    );
  }, []);

  function handleOrgClick(org: Organization) {
    selectOrg(org.slug);
  }

  function handleOrgCreated(org: Organization) {
    setDialogOpen(false);
    selectOrg(org.slug);
  }

  function handleJoinSuccess(org: Organization) {
    selectOrg(org.slug);
  }

  const hasMyOrgs = data.myOrgs.length > 0;
  const hasJoinable = data.joinableOrgs.length > 0;
  const isEmpty = !hasMyOrgs && !hasJoinable;

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      {/* Grain overlay */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
        }}
      />

      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold">Organizations</h1>
          <p className="mt-1 text-muted-foreground">
            Select an organization to continue
          </p>
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {error && (
          <Card className="border-destructive/50">
            <CardContent className="pt-6">
              <p className="text-center text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {!loading && !error && (
          <>
            {isEmpty && (
              <Card>
                <CardContent className="py-12 text-center">
                  <Building2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
                  <p className="text-muted-foreground">
                    No organizations yet. Create one to get started.
                  </p>
                </CardContent>
              </Card>
            )}

            {hasMyOrgs && (
              <div className="space-y-2">
                <h2 className="text-sm font-medium text-muted-foreground px-1">
                  Your Organizations
                </h2>
                {data.myOrgs.map((org) => (
                  <OrgCard
                    key={org.id}
                    org={org}
                    onClick={() => handleOrgClick(org)}
                  />
                ))}
              </div>
            )}

            {hasJoinable && (
              <div className="space-y-2">
                <h2 className="text-sm font-medium text-muted-foreground px-1">
                  Available to Join
                </h2>
                {data.joinableOrgs.map((org) => (
                  <JoinableOrgCard
                    key={org.id}
                    org={org}
                    api={api}
                    onJoined={() => handleJoinSuccess(org)}
                  />
                ))}
              </div>
            )}

            <Button
              className="w-full"
              variant="secondary"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Organization
            </Button>
          </>
        )}

        <CreateOrgDialog
          api={api}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onCreated={handleOrgCreated}
        />
      </div>
    </div>
  );
}

function OrgCard({ org, onClick }: { org: Organization; onClick: () => void }) {
  const initials = orgInitials(org.name);

  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-accent/5"
      onClick={onClick}
    >
      <CardContent className="flex items-center gap-4 p-4">
        <Avatar size="lg">
          {org.avatarUrl && <AvatarImage src={org.avatarUrl} alt={org.name} />}
          <AvatarFallback className="bg-primary/10 text-primary font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <CardTitle className="text-base truncate">{org.name}</CardTitle>
          <CardDescription className="text-sm truncate">{org.slug}</CardDescription>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
      </CardContent>
    </Card>
  );
}

function JoinableOrgCard({
  org,
  api,
  onJoined,
}: {
  org: Organization;
  api: ApiClient;
  onJoined: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initials = orgInitials(org.name);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const token = getToken();
    if (!token) {
      setError("Session expired. Please log in again.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.organizationJoin(token, org.id, {
        firstName: firstName.trim(),
        username: username.trim(),
      });
      onJoined();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "FORBIDDEN" && err.message.includes("deactivated")) {
          setError("Your account has been deactivated in this organization. Contact an admin.");
        } else {
          setError(err.message);
        }
      } else {
        setError(err instanceof Error ? err.message : "Failed to join organization");
      }
      setLoading(false);
    }
  }

  const canSubmit = firstName.trim().length > 0 && username.trim().length > 0;

  return (
    <Card className="transition-colors">
      <CardContent className="p-4">
        <div
          className="flex items-center gap-4 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <Avatar size="lg">
            {org.avatarUrl && <AvatarImage src={org.avatarUrl} alt={org.name} />}
            <AvatarFallback className="bg-muted text-muted-foreground font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base truncate">{org.name}</CardTitle>
            <CardDescription className="text-sm truncate">{org.slug}</CardDescription>
          </div>
          <LogIn className="h-5 w-5 text-primary shrink-0" />
        </div>

        {expanded && (
          <form onSubmit={handleJoin} className="mt-4 space-y-3 border-t pt-4">
            <p className="text-sm text-muted-foreground">
              Enter your details to join this organization
            </p>
            <div className="space-y-2">
              <label htmlFor={`join-fn-${org.id}`} className="text-sm font-medium">
                First name
              </label>
              <Input
                id={`join-fn-${org.id}`}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jane"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor={`join-un-${org.id}`} className="text-sm font-medium">
                Username
              </label>
              <Input
                id={`join-un-${org.id}`}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="jane"
                disabled={loading}
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" disabled={loading || !canSubmit} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Joining...
                </>
              ) : (
                "Join Organization"
              )}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function CreateOrgDialog({
  api,
  open,
  onOpenChange,
  onCreated,
}: {
  api: ApiClient;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (org: Organization) => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [firstName, setFirstName] = useState("");
  const [username, setUsername] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugEdited) {
      setSlug(nameToSlug(value));
    }
  }

  function handleSlugChange(value: string) {
    setSlugEdited(true);
    setSlug(nameToSlug(value));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const token = getToken();
    if (!token) {
      setError("Session expired. Please log in again.");
      setLoading(false);
      return;
    }

    try {
      const { organization } = await api.organizationCreate(token, {
        name: name.trim(),
        slug: slug.trim(),
        firstName: firstName.trim(),
        username: username.trim(),
      });
      onCreated(organization);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create organization",
      );
      setLoading(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setName("");
      setSlug("");
      setFirstName("");
      setUsername("");
      setSlugEdited(false);
      setError(null);
    }
    onOpenChange(nextOpen);
  }

  const canSubmit =
    name.trim().length > 0 &&
    slug.trim().length > 0 &&
    firstName.trim().length > 0 &&
    username.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">Create Organization</DialogTitle>
          <DialogDescription>
            Set up a new workspace for your team
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="org-name" className="text-sm font-medium">
              Organization name
            </label>
            <Input
              id="org-name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="My Team"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="org-slug" className="text-sm font-medium">
              URL slug
            </label>
            <Input
              id="org-slug"
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="my-team"
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              daycare.local/{slug || "my-team"}
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="org-first-name" className="text-sm font-medium">
              Your first name
            </label>
            <Input
              id="org-first-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Jane"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="org-username" className="text-sm font-medium">
              Username
            </label>
            <Input
              id="org-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="jane"
              disabled={loading}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !canSubmit}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function selectOrg(slug: string) {
  const session = sessionGet();
  if (session) {
    sessionSet({ ...session, orgSlug: slug });
  }
  // Hard redirect so main.tsx re-reads session with orgSlug
  window.location.href = `/${slug}`;
}

function getToken(): string | null {
  return sessionGet()?.token ?? null;
}

async function loadOrgsData(api: ApiClient, token: string | null): Promise<OrgsData> {
  if (!token) return { myOrgs: [], joinableOrgs: [] };

  const [meResult, availableResult] = await Promise.allSettled([
    api.meGet(token),
    api.organizationAvailableList(token),
  ]);

  if (meResult.status === "rejected") throw meResult.reason;

  const myOrgIds = new Set(meResult.value.organizations.map((o) => o.id));
  const availableOrgs = availableResult.status === "fulfilled" ? availableResult.value.organizations : [];
  const joinableOrgs = availableOrgs.filter((o) => !myOrgIds.has(o.id));

  return {
    myOrgs: meResult.value.organizations,
    joinableOrgs,
  };
}

function orgInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
