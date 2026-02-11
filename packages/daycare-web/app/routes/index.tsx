import { createRoute, redirect } from "@tanstack/react-router";
import { rootRoute } from "./__root";
import { guardIndex } from "@/app/lib/routeGuard";

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: ({ context }) => {
    const result = guardIndex(context.auth);
    if (result.redirect) {
      throw redirect({ to: result.redirect });
    }
  },
  component: () => null,
});
