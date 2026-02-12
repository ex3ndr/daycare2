import { createRoute, Outlet } from "@tanstack/react-router";
import { workspaceRoute } from "./_workspace";
import { WorkspaceShell } from "@/app/components/workspace/WorkspaceShell";

export const orgSlugRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "$orgSlug",
  component: OrgLayout,
});

function OrgLayout() {
  return (
    <WorkspaceShell>
      <Outlet />
    </WorkspaceShell>
  );
}
