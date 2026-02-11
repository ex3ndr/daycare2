import { createRoute, redirect } from "@tanstack/react-router";
import { rootRoute } from "./__root";
import { guardAuthenticated } from "@/app/lib/routeGuard";

export const orgsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "orgs",
  beforeLoad: ({ context }) => {
    const result = guardAuthenticated(context.auth);
    if (result.redirect) {
      throw redirect({ to: result.redirect });
    }
  },
  component: OrgsPage,
});

function OrgsPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold">Organizations</h1>
        <p className="text-muted-foreground">Organization picker placeholder</p>
      </div>
    </div>
  );
}
