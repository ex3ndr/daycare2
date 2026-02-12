import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
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
import { LogOut, ArrowLeftRight, Plus, UserPen } from "lucide-react";
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
    <div className="flex w-[67px] shrink-0 flex-col items-center bg-[#3a0d49] pt-3 pb-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => navigate({ to: "/$orgSlug", params: { orgSlug } })}
            className="rounded-[10px] transition-opacity hover:opacity-90"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[#d2ced8] text-[15px] text-[#7b4a8e]">
              <span className="-translate-y-[0.5px]">↗</span>
            </div>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">{orgName}</TooltipContent>
      </Tooltip>

      <button className="mt-4 flex h-8 w-8 flex-col items-center justify-center rounded-[8px] bg-[#59356a] text-[#ccbed6]">
        <span className="text-[12px] leading-none">•••</span>
        <span className="mt-[1px] text-[8px] leading-none">More</span>
      </button>

      <div className="flex-1" />

      <button className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-[#5b2f6f] text-[#d8cade] hover:bg-[#6b3a81]">
        <Plus className="h-4 w-4" />
      </button>

      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button className="rounded-full ring-2 ring-transparent transition-all hover:ring-white/25 focus-visible:outline-none focus-visible:ring-white/35">
                <Avatar size="sm">
                  {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
                  <AvatarFallback className="bg-[#705280] text-[#ece3f1] text-[10px]">
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

      <ProfileEditor open={profileEditorOpen} onOpenChange={setProfileEditorOpen} />
    </div>
  );
}
