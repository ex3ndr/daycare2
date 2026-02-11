import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import type { AuthState } from "@/app/lib/routeGuard";
import { ErrorBoundary } from "@/app/components/ErrorBoundary";

export type RouterContext = {
  auth: AuthState;
};

export const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

function RootLayout() {
  return (
    <ErrorBoundary>
      <Outlet />
    </ErrorBoundary>
  );
}
