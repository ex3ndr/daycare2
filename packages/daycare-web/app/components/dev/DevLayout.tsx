import { useNavigate } from "@tanstack/react-router";
import { useStorage } from "@/app/sync/AppContext";
import { Blocks } from "lucide-react";
import { Separator } from "@/app/components/ui/separator";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import { cn } from "@/app/lib/utils";
import { TopBar } from "@/app/components/workspace/TopBar";
import { DevComponents } from "./DevComponents";

export type DevTab = "components";

const TABS: Array<{ id: DevTab; label: string; icon: typeof Blocks }> = [
  { id: "components", label: "Components", icon: Blocks },
];

export function DevLayout({ initialTab }: { initialTab?: DevTab }) {
  const navigate = useNavigate();
  const orgSlug = useStorage((s) => s.objects.context.orgSlug);

  const tab: DevTab = initialTab ?? "components";

  function setTab(newTab: DevTab) {
    navigate({ to: "/$orgSlug/dev", params: { orgSlug }, search: { tab: newTab } });
  }

  return (
    <div className="flex flex-1 min-w-0 overflow-hidden">
      {/* Sidebar nav */}
      <div className="flex w-[280px] shrink-0 flex-col rounded-tl-md bg-sidebar text-sidebar-foreground">
        <div className="flex h-10 items-center px-4 bg-sidebar-header">
          <h2 className="font-display text-lg font-semibold">Dev Tools</h2>
        </div>
        <Separator className="bg-sidebar-border" />
        <ScrollArea className="flex-1">
          <div className="py-2">
            <p className="flex items-center gap-1 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-sidebar-muted-foreground">
              Pages
            </p>
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-4 py-1.5 text-sm rounded-none transition-colors",
                    tab === t.id
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
        <TopBar />
        <ScrollArea className="flex-1 bg-background">
          <div className="max-w-4xl mx-auto p-8">
            {tab === "components" && <DevComponents />}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
