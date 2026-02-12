import { createRoute, Outlet } from "@tanstack/react-router";
import { workspaceRoute } from "./_workspace";
import { Rail } from "@/app/components/workspace/Rail";

export const orgSlugRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "$orgSlug",
  component: OrgLayout,
});

function OrgLayout() {
  return (
    <>
      <Rail />
      <div className="flex flex-1 min-w-0 overflow-hidden bg-rail">
        <Outlet />
      </div>
    </>
  );
}
