import { createRoute, Outlet } from "@tanstack/react-router";
import { orgSlugRoute } from "./_workspace.$orgSlug";

export const dmRoute = createRoute({
  getParentRoute: () => orgSlugRoute,
  path: "dm/$dmId",
  component: DmPage,
});

function DmPage() {
  const { dmId } = dmRoute.useParams();
  return (
    <div className="flex flex-1">
      <div className="flex flex-1 flex-col">
        <div className="flex flex-1 items-center justify-center">
          <p className="text-muted-foreground">DM {dmId} placeholder</p>
        </div>
      </div>
      <Outlet />
    </div>
  );
}
