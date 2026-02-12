import { createRoute, Outlet } from "@tanstack/react-router";
import { orgSlugRoute } from "./_workspace.$orgSlug";
import { WorkspaceChatLayout } from "@/app/fragments/workspace/WorkspaceChatLayout";

export const chatLayoutRoute = createRoute({
  getParentRoute: () => orgSlugRoute,
  id: "_chat",
  component: ChatLayout,
});

function ChatLayout() {
  return (
    <WorkspaceChatLayout>
      <Outlet />
    </WorkspaceChatLayout>
  );
}
