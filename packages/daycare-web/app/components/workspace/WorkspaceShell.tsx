import { ReactNode } from "react";
import { Rail } from "./Rail";
import { TopBar } from "./TopBar";

export function WorkspaceShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#3a0d49]">
      <TopBar />
      <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
        <Rail />
        <div className="flex flex-1 flex-col min-w-0 overflow-hidden p-[4px] border-rounded-[6px] overflow-hidden">
          <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
