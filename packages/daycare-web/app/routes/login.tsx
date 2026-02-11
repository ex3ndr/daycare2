import { createRoute, redirect } from "@tanstack/react-router";
import { rootRoute } from "./__root";
import { guardLogin } from "@/app/lib/routeGuard";

export const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "login",
  beforeLoad: ({ context }) => {
    const result = guardLogin(context.auth);
    if (result.redirect) {
      throw redirect({ to: result.redirect });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold">Login</h1>
        <p className="text-muted-foreground">Login page placeholder</p>
      </div>
    </div>
  );
}
