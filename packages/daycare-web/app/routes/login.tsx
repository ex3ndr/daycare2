import { useState } from "react";
import { createRoute, redirect, useRouter } from "@tanstack/react-router";
import { rootRoute } from "./__root";
import { guardLogin } from "@/app/lib/routeGuard";
import { sessionSet } from "@/app/lib/sessionStore";
import { apiClientCreate } from "@/app/daycare/api/apiClientCreate";

const api = apiClientCreate("/api");

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
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { token, account } = await api.authLogin(email);
      sessionSet({ token, accountId: account.id });
      router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold">Login</h1>
        <form onSubmit={handleLogin} className="mt-4 space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            className="w-full rounded border px-3 py-2"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !email}
            className="w-full rounded bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
          >
            {loading ? "Logging in..." : "Log in"}
          </button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </form>
      </div>
    </div>
  );
}
