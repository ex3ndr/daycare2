import { Search } from "lucide-react";

export function TopBar() {
  return (
    <div className="flex h-[39px] shrink-0 items-center px-3">
      <div className="w-[67px] shrink-0" />
      <div className="flex h-6 w-full max-w-[680px] items-center gap-2 rounded-md bg-white/10 px-3 text-[13px] text-[#d8cade]/80">
        <Search className="h-3.5 w-3.5 shrink-0" />
        <span>Search Openland</span>
      </div>
    </div>
  );
}
