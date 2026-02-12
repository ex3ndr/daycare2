import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useApp, useStorage } from "@/app/sync/AppContext";
import { Settings, Users, Mail, Globe } from "lucide-react";
import { Separator } from "@/app/components/ui/separator";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import { cn } from "@/app/lib/utils";
import { toastAdd } from "@/app/stores/toastStoreContext";
import { WorkspaceLayoutTopBar } from "@/app/fragments/workspace/WorkspaceLayoutTopBar";
import { SettingsGeneral } from "./SettingsGeneral";
import { SettingsMembers } from "./SettingsMembers";
import { SettingsInvites } from "./SettingsInvites";
import { SettingsDomains } from "./SettingsDomains";

export type SettingsTab = "general" | "members" | "invites" | "domains";

const TABS: Array<{ id: SettingsTab; label: string; icon: typeof Settings; ownerOnly?: boolean }> = [
  { id: "general", label: "General", icon: Settings },
  { id: "members", label: "Members", icon: Users },
  { id: "invites", label: "Invites", icon: Mail, ownerOnly: true },
  { id: "domains", label: "Domains", icon: Globe, ownerOnly: true },
];

export function SettingsLayout({ initialTab }: { initialTab?: SettingsTab }) {
  const app = useApp();
  const navigate = useNavigate();
  const orgSlug = useStorage((s) => s.objects.context.orgSlug);

  const tab: SettingsTab = initialTab ?? "general";
  const [orgRole, setOrgRole] = useState<"owner" | "member">("member");
  const [loading, setLoading] = useState(true);

  function setTab(newTab: SettingsTab) {
    navigate({ to: "/$orgSlug/settings", params: { orgSlug }, search: { tab: newTab } });
  }

  useEffect(() => {
    app.api
      .profileGet(app.token, app.orgId)
      .then(({ profile }) => {
        setOrgRole(profile.orgRole ?? "member");
      })
      .catch(() => {
        toastAdd("Failed to load settings. Some tabs may be hidden.", "error");
      })
      .finally(() => setLoading(false));
  }, [app]);

  const isOwner = orgRole === "owner";

  // Redirect non-owners away from owner-only tabs (e.g. direct URL navigation)
  useEffect(() => {
    if (!loading && !isOwner) {
      const current = TABS.find((t) => t.id === tab);
      if (current?.ownerOnly) setTab("general");
    }
  }, [loading, isOwner, tab]);

  const visibleTabs = TABS.filter((t) => !t.ownerOnly || isOwner);

  // Prevent rendering owner-only tab content while redirect is pending
  const effectiveTab: SettingsTab =
    !isOwner && TABS.find((t) => t.id === tab)?.ownerOnly ? "general" : tab;

  return (
    <div className="flex flex-1 min-w-0 overflow-hidden">
      {/* Sidebar nav */}
      <div className="flex w-[280px] shrink-0 flex-col rounded-tl-md bg-sidebar text-sidebar-foreground">
        <div className="flex h-10 items-center px-4 bg-sidebar-header">
          <h2 className="font-display text-lg font-semibold">Settings</h2>
        </div>
        <Separator className="bg-sidebar-border" />
        <ScrollArea className="flex-1">
          <div className="py-2">
            <p className="flex items-center gap-1 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-sidebar-muted-foreground">
              General
            </p>
            {visibleTabs.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-4 py-1.5 text-sm rounded-none transition-colors",
                    effectiveTab === t.id
                      ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                      : "text-sidebar-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Content column */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <WorkspaceLayoutTopBar />
        <ScrollArea className="flex-1 bg-background">
        <div className="max-w-2xl mx-auto p-8">
          {loading ? (
            <p className="text-muted-foreground text-sm">Loading...</p>
          ) : (
            <>
              {effectiveTab === "general" && <SettingsGeneral isOwner={isOwner} />}
              {effectiveTab === "members" && <SettingsMembers isOwner={isOwner} />}
              {effectiveTab === "invites" && <SettingsInvites isOwner={isOwner} />}
              {effectiveTab === "domains" && <SettingsDomains isOwner={isOwner} />}
            </>
          )}
        </div>
      </ScrollArea>
      </div>
    </div>
  );
}
