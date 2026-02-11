import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useApp, useStorage } from "@/app/sync/AppContext";
import { useShallow } from "zustand/react/shallow";
import { sessionClear } from "@/app/lib/sessionStore";
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar";
import { Badge } from "@/app/components/ui/badge";
import { Separator } from "@/app/components/ui/separator";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/app/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { LogOut, ArrowLeftRight, Settings, UserPen } from "lucide-react";
import { ProfileEditor } from "./ProfileEditor";

export function Rail() {
  const app = useApp();
  const navigate = useNavigate();

  const { orgName, orgSlug, firstName, lastName, username, avatarUrl } = useStorage(
    useShallow((s) => ({
      orgName: s.objects.context.orgName,
      orgSlug: s.objects.context.orgSlug,
      firstName: s.objects.context.firstName,
      lastName: s.objects.context.lastName,
      username: s.objects.context.username,
      avatarUrl: s.objects.context.avatarUrl,
    })),
  );

  const [orgRole, setOrgRole] = useState<"owner" | "member">("member");
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);

  useEffect(() => {
    app.api
      .profileGet(app.token, app.orgId)
      .then(({ profile }) => setOrgRole(profile.orgRole ?? "member"))
      .catch(() => {});
  }, [app]);

  const orgInitials = orgName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

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
                {orgInitials}
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

      {/* Profile dropdown */}
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button className="mt-1 rounded-full ring-2 ring-transparent transition-all hover:ring-rail-foreground/30 focus-visible:outline-none focus-visible:ring-rail-foreground/50">
                <Avatar size="sm">
                  {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
                  <AvatarFallback className="bg-rail-foreground/20 text-rail-foreground text-xs">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="right">{displayName}</TooltipContent>
        </Tooltip>

        <DropdownMenuContent side="right" align="end" className="w-56">
          {/* User info header */}
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium leading-none">{displayName}</p>
              <p className="text-xs text-muted-foreground">@{username}</p>
              <Badge variant={orgRole === "owner" ? "accent" : "neutral"} size="sm" className="w-fit mt-0.5">
                {orgRole}
              </Badge>
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

      <ProfileEditor open={profileEditorOpen} onOpenChange={setProfileEditorOpen} />
    </div>
  );
}
