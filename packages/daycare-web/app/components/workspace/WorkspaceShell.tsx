import { ReactNode } from "react";
import { Rail } from "./Rail";
import { TopBar } from "./TopBar";

export function WorkspaceShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#3a0d49]">
      <TopBar />
      <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
        <Rail />
        <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
          <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
            {children}
          </div>
          <div className="flex h-12 shrink-0 items-center border-t border-[#c7d7df] bg-[#e7f5fd] px-3 text-[14px] text-[#1f2528]">
            <span className="mr-2 text-[#8c7a35]">⚠</span>
            <span>Slack needs your permission to enable notifications.</span>
            <button className="ml-1 text-[#1264a3] hover:underline">Enable notifications</button>
            <button className="ml-auto text-[#5f6f76]">×</button>
          </div>
        </div>
      </div>
    </div>
  );
}
