import { createRoute, Outlet } from "@tanstack/react-router";
import { orgSlugRoute } from "./_workspace.$orgSlug";
import { Sidebar } from "@/app/components/workspace/Sidebar";
import { TopBar } from "@/app/components/workspace/TopBar";

export const chatLayoutRoute = createRoute({
  getParentRoute: () => orgSlugRoute,
  id: "_chat",
  component: ChatLayout,
});

function ChatLayout() {
  return (
    <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
      <TopBar />
      <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden rounded-tl-[8px] rounded-tr-[8px] border border-[#d7d7da] bg-background">
        <Sidebar />
        <div className="flex flex-1 min-w-0 overflow-hidden bg-background">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
