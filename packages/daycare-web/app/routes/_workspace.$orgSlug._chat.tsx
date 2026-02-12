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
    <>
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <TopBar />
        <div className="flex flex-1 min-w-0 overflow-hidden bg-background">
          <Outlet />
        </div>
      </div>
    </>
  );
}
