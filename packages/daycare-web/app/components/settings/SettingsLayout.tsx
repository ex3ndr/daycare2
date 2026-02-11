import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useApp, useStorage } from "@/app/sync/AppContext";
import { ArrowLeft, Settings, Users, Mail, Globe } from "lucide-react";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import { cn } from "@/app/lib/utils";
import { SettingsGeneral } from "./SettingsGeneral";
import { SettingsMembers } from "./SettingsMembers";
import { SettingsInvites } from "./SettingsInvites";

export type SettingsTab = "general" | "members" | "invites" | "domains";

const TABS: Array<{ id: SettingsTab; label: string; icon: typeof Settings; ownerOnly?: boolean }> = [
  { id: "general", label: "General", icon: Settings },
  { id: "members", label: "Members", icon: Users },
  { id: "invites", label: "Invites", icon: Mail, ownerOnly: true },
  { id: "domains", label: "Domains", icon: Globe, ownerOnly: true },
];

export function SettingsLayout() {
  const app = useApp();
  const navigate = useNavigate();
  const orgSlug = useStorage((s) => s.objects.context.orgSlug);
  const orgName = useStorage((s) => s.objects.context.orgName);

  const [tab, setTab] = useState<SettingsTab>("general");
  const [orgRole, setOrgRole] = useState<"owner" | "member">("member");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    app.api
      .profileGet(app.token, app.orgId)
      .then(({ profile }) => {
        setOrgRole(profile.orgRole ?? "member");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [app]);

  const isOwner = orgRole === "owner";

  const visibleTabs = TABS.filter((t) => !t.ownerOnly || isOwner);

  return (
    <div className="flex flex-1 min-w-0 overflow-hidden">
      {/* Sidebar nav */}
      <div className="w-56 shrink-0 border-r bg-sidebar flex flex-col">
        <div className="p-4 border-b">
          <button
            onClick={() => navigate({ to: "/$orgSlug", params: { orgSlug } })}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to {orgName}
          </button>
        </div>
        <div className="p-2 flex-1">
          <p className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Settings
          </p>
          {visibleTabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors",
                  tab === t.id
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                )}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="max-w-2xl mx-auto p-8">
          {loading ? (
            <p className="text-muted-foreground text-sm">Loading...</p>
          ) : (
            <>
              {tab === "general" && <SettingsGeneral isOwner={isOwner} />}
              {tab === "members" && <SettingsMembers isOwner={isOwner} />}
              {tab === "invites" && <SettingsInvites isOwner={isOwner} />}
              {tab === "domains" && <SettingsDomainsPlaceholder />}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function SettingsDomainsPlaceholder() {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Domains</h2>
      <p className="text-muted-foreground text-sm">Domain management coming soon.</p>
    </div>
  );
}
