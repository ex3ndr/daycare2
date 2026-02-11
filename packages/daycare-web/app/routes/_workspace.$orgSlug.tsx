import { createRoute, Outlet } from "@tanstack/react-router";
import { workspaceRoute } from "./_workspace";

export const orgSlugRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "$orgSlug",
  component: OrgLayout,
});

function OrgLayout() {
  return <Outlet />;
}
