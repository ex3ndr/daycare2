import { createRoute, Outlet } from "@tanstack/react-router";
import { workspaceRoute } from "./_workspace";
import { WorkspaceLayout } from "@/app/fragments/workspace/WorkspaceLayout";

export const orgSlugRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "$orgSlug",
  component: OrgLayout,
});

function OrgLayout() {
  return (
    <WorkspaceLayout>
      <Outlet />
    </WorkspaceLayout>
  );
}
