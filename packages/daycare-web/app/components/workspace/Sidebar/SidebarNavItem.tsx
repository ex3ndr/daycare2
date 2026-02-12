import type { ReactNode } from "react";

export function SidebarNavItem({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <button className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-white/10">
      <span className="shrink-0 text-[#cdbed7]">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
