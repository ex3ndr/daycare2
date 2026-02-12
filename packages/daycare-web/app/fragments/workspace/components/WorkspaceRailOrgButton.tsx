import { useNavigate } from "@tanstack/react-router";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/app/components/ui/tooltip";

export function WorkspaceRailOrgButton({
  orgName,
  orgSlug,
}: {
  orgName: string;
  orgSlug: string;
}) {
  const navigate = useNavigate();
  const initial = orgName?.[0]?.toUpperCase() ?? "?";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={() => navigate({ to: "/$orgSlug", params: { orgSlug } })}
          className="rounded-xl transition-opacity hover:opacity-90"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-base font-bold text-foreground shadow-sm">
            {initial}
          </div>
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{orgName}</TooltipContent>
    </Tooltip>
  );
}
