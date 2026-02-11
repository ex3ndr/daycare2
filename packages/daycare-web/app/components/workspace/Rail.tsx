import { useNavigate } from "@tanstack/react-router";
import { useApp, useStorage } from "@/app/sync/AppContext";
import { sessionClear } from "@/app/lib/sessionStore";
import { Avatar, AvatarFallback } from "@/app/components/ui/avatar";
import { Separator } from "@/app/components/ui/separator";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/app/components/ui/tooltip";
import { LogOut, ArrowLeftRight, Settings } from "lucide-react";

export function Rail() {
  const app = useApp();
  const navigate = useNavigate();
  const orgName = useStorage((s) => s.objects.context.orgName);
  const orgSlug = useStorage((s) => s.objects.context.orgSlug);

  const initials = orgName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  function handleSwitchOrg() {
    app.destroy();
    sessionClear();
    window.location.href = "/orgs";
  }

  function handleLogout() {
    app.api.authLogout(app.token).catch(() => {});
    app.destroy();
    sessionClear();
    window.location.href = "/login";
  }

  return (
    <div className="flex w-[76px] shrink-0 flex-col items-center bg-rail py-4">
      {/* Org avatar */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => navigate({ to: "/$orgSlug", params: { orgSlug } })}
            className="rounded-xl transition-opacity hover:opacity-80"
          >
            <Avatar size="lg">
              <AvatarFallback className="bg-primary text-primary-foreground font-semibold rounded-xl">
                {initials}
              </AvatarFallback>
            </Avatar>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">{orgName}</TooltipContent>
      </Tooltip>

      <Separator className="my-3 w-8 bg-rail-foreground/20" />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Settings */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => navigate({ to: "/$orgSlug/settings", params: { orgSlug } })}
            className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg text-rail-foreground/60 transition-colors hover:bg-rail-foreground/10 hover:text-rail-foreground"
          >
            <Settings className="h-5 w-5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">Settings</TooltipContent>
      </Tooltip>

      {/* Switch org */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleSwitchOrg}
            className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg text-rail-foreground/60 transition-colors hover:bg-rail-foreground/10 hover:text-rail-foreground"
          >
            <ArrowLeftRight className="h-5 w-5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">Switch organization</TooltipContent>
      </Tooltip>

      {/* Logout */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleLogout}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-rail-foreground/60 transition-colors hover:bg-rail-foreground/10 hover:text-rail-foreground"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">Log out</TooltipContent>
      </Tooltip>
    </div>
  );
}
