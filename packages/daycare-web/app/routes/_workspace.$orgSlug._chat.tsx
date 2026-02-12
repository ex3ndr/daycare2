import { createRoute, Outlet } from "@tanstack/react-router";
import { orgSlugRoute } from "./_workspace.$orgSlug";
import { Sidebar } from "@/app/components/workspace/Sidebar";

export const chatLayoutRoute = createRoute({
  getParentRoute: () => orgSlugRoute,
  id: "_chat",
  component: ChatLayout,
});

function ChatLayout() {
  return (
    <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
      <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden rounded-[8px] bg-background">
        <Sidebar />
        <div className="flex flex-1 min-w-0 overflow-hidden">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
