import { useStorage } from "@/app/sync/AppContext";
import { useShallow } from "zustand/react/shallow";
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar";
import { ArrowLeft, ArrowRight, HelpCircle, RotateCcw, Search } from "lucide-react";

export function TopBar() {
  const { firstName, lastName, username, avatarUrl } = useStorage(
    useShallow((s) => ({
      firstName: s.objects.context.firstName,
      lastName: s.objects.context.lastName,
      username: s.objects.context.username,
      avatarUrl: s.objects.context.avatarUrl,
    })),
  );

  const userInitials =
    ((firstName?.[0] ?? "") + (lastName?.[0] ?? "")).toUpperCase() ||
    username[0]?.toUpperCase() ||
    "?";

  return (
    <div className="flex h-[39px] shrink-0 items-center gap-2 border-b border-[#6b4573] bg-[#5a3560] px-3 text-[#d7cae0]">
      <button className="flex h-5 w-5 items-center justify-center rounded text-[#b59ec1] hover:bg-white/10">
        <ArrowLeft className="h-3.5 w-3.5" />
      </button>
      <button className="flex h-5 w-5 items-center justify-center rounded text-[#b59ec1] hover:bg-white/10">
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
      <button className="flex h-5 w-5 items-center justify-center rounded text-[#b59ec1] hover:bg-white/10">
        <RotateCcw className="h-3.5 w-3.5" />
      </button>

      <div className="ml-1 flex h-6 w-full max-w-[680px] items-center gap-2 rounded-md bg-white/10 px-3 text-[13px] text-[#d8cade]/80">
        <Search className="h-3.5 w-3.5 shrink-0" />
        <span>Search Openland</span>
      </div>

      <div className="ml-2 rounded-md bg-[#6a4d76] p-[1px]">
        <Avatar size="xs">
          {avatarUrl && <AvatarImage src={avatarUrl} alt={username} />}
          <AvatarFallback className="bg-[#896899] text-[#f0e9f4] text-[9px]">
            {userInitials}
          </AvatarFallback>
        </Avatar>
      </div>

      <button className="ml-auto flex h-5 w-5 items-center justify-center rounded text-[#b59ec1] hover:bg-white/10">
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
