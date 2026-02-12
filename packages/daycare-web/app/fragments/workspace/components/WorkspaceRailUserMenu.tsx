import { useState, useEffect } from "react";
import { useApp, useStorage } from "@/app/sync/AppContext";
import { useShallow } from "zustand/react/shallow";
import { sessionClear } from "@/app/lib/sessionStore";
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/app/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { LogOut, ArrowLeftRight, UserPen } from "lucide-react";
import { WorkspaceProfileEditor } from "./WorkspaceProfileEditor";

export function WorkspaceRailUserMenu() {
  const app = useApp();

  const { firstName, lastName, username, avatarUrl } = useStorage(
    useShallow((s) => ({
      firstName: s.objects.context.firstName,
      lastName: s.objects.context.lastName,
      username: s.objects.context.username,
      avatarUrl: s.objects.context.avatarUrl,
    })),
  );

  const [orgRole, setOrgRole] = useState<"owner" | "member">("member");
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);

  // Fetch org role on mount — no hook abstraction for this one-off API call
  useEffect(() => {
    app.api
      .profileGet(app.token, app.orgId)
      .then(({ profile }) => setOrgRole(profile.orgRole ?? "member"))
      .catch(() => {});
  }, [app]);

  const displayName = [firstName, lastName].filter(Boolean).join(" ") || username;
  const userInitials = ((firstName?.[0] ?? "") + (lastName?.[0] ?? "")).toUpperCase() || username[0]?.toUpperCase() || "?";

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
    <>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button className="rounded-full ring-2 ring-transparent transition-all hover:ring-foreground/15 focus-visible:outline-none focus-visible:ring-foreground/25">
                <Avatar size="sm">
                  {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
                  <AvatarFallback className="bg-primary/20 text-primary text-[10px]">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="right">{displayName}</TooltipContent>
        </Tooltip>

        <DropdownMenuContent side="right" align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium leading-none">{displayName}</p>
              <p className="text-xs text-muted-foreground">@{username}</p>
              <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">{orgRole}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setProfileEditorOpen(true)}>
            <UserPen className="mr-2 h-4 w-4" />
            Edit Profile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleSwitchOrg}>
            <ArrowLeftRight className="mr-2 h-4 w-4" />
            Switch Organization
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Log Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <WorkspaceProfileEditor open={profileEditorOpen} onOpenChange={setProfileEditorOpen} />
    </>
  );
}
