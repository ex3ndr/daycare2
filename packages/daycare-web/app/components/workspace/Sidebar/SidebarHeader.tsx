import { useNavigate } from "@tanstack/react-router";
import { Separator } from "@/app/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { ChevronDown, Settings, Users, Mail, PencilLine } from "lucide-react";

export function SidebarHeader({ orgName, orgSlug }: { orgName: string; orgSlug: string }) {
  const navigate = useNavigate();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex h-[52px] w-full items-center gap-1 px-4 text-left bg-sidebar hover:brightness-110 transition-all focus-visible:outline-none">
            <h2 className="font-display text-[20px] leading-none font-semibold truncate">{orgName}</h2>
            <ChevronDown className="h-4 w-4 shrink-0 text-sidebar-muted-foreground" />
            <span className="ml-auto flex items-center gap-3 text-sidebar-muted-foreground">
              <Settings className="h-4 w-4" />
              <PencilLine className="h-4 w-4" />
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <p className="text-sm font-medium">{orgName}</p>
            <p className="text-xs text-muted-foreground">/{orgSlug}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() =>
              navigate({
                to: "/$orgSlug/settings",
                params: { orgSlug },
                search: { tab: "general" },
              })
            }
          >
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              navigate({
                to: "/$orgSlug/settings",
                params: { orgSlug },
                search: { tab: "invites" },
              })
            }
          >
            <Mail className="mr-2 h-4 w-4" />
            Invite People
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              navigate({
                to: "/$orgSlug/settings",
                params: { orgSlug },
                search: { tab: "members" },
              })
            }
          >
            <Users className="mr-2 h-4 w-4" />
            Members
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Separator className="bg-sidebar-border" />

      <div className="px-4 py-3">
        <button className="flex h-8 w-full items-center justify-center rounded-md border border-[#d6d5d9] bg-[#fafafb] text-sm font-semibold text-[#3d2e42]">
          <span className="mr-1.5 text-sm">⚡</span>
          Upgrade Plan
        </button>
      </div>
    </>
  );
}
