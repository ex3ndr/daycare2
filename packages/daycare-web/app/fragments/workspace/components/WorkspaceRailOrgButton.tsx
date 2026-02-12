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

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={() => navigate({ to: "/$orgSlug", params: { orgSlug } })}
          className="rounded-[10px] transition-opacity hover:opacity-90"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-primary/15 text-[15px] text-primary">
            <span className="-translate-y-[0.5px]">{"\u2197"}</span>
          </div>
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{orgName}</TooltipContent>
    </Tooltip>
  );
}
