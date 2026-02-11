import { createRoute, Outlet, redirect } from "@tanstack/react-router";
import { rootRoute } from "./__root";
import { guardWorkspace } from "@/app/lib/routeGuard";

export const workspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "workspace",
  beforeLoad: ({ context }) => {
    const result = guardWorkspace(context.auth);
    if (result.redirect) {
      throw redirect({ to: result.redirect });
    }
  },
  component: WorkspaceLayout,
});

function WorkspaceLayout() {
  return (
    <div className="flex h-screen">
      <div className="flex flex-1">
        <Outlet />
      </div>
    </div>
  );
}
