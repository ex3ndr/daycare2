import { createRoute, Outlet, redirect } from "@tanstack/react-router";
import { rootRoute } from "./__root";
import { guardWorkspace } from "@/app/lib/routeGuard";
import { useEffect, useState } from "react";
import { AppContext } from "@/app/sync/AppContext";
import { AppController } from "@/app/sync/AppController";
import { apiClientCreate } from "@/app/daycare/api/apiClientCreate";
import { sessionGet } from "@/app/lib/sessionStore";
import { TooltipProvider } from "@/app/components/ui/tooltip";
import { SearchCommandPalette } from "@/app/components/search/SearchCommandPalette";
import { KeyboardShortcutsHelp } from "@/app/components/workspace/KeyboardShortcutsHelp";
import { PhotoViewer } from "@/app/components/ui/PhotoViewer";
import { Loader2 } from "lucide-react";
import { ErrorBoundary } from "@/app/components/ErrorBoundary";

const api = apiClientCreate("");

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
  const [controller, setController] = useState<AppController | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const session = sessionGet();
    if (!session) return;

    let destroyed = false;

    AppController.create(api, session.token)
      .then((c) => {
        if (destroyed) {
          c.destroy();
          return;
        }
        setController(c);
        c.startSSE();
        c.startPresence();
      })
      .catch((err) => {
        if (!destroyed) {
          setError(err instanceof Error ? err.message : "Failed to initialize");
        }
      });

    return () => {
      destroyed = true;
      // Controller cleanup happens in a separate effect
    };
  }, []);

  // Cleanup controller on unmount (separate effect so it runs on the actual controller instance)
  useEffect(() => {
    return () => {
      controller?.destroy();
    };
  }, [controller]);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (!controller) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AppContext.Provider value={controller}>
      <TooltipProvider>
        <div className="h-screen w-screen overflow-hidden bg-[#310b3b] p-[2px]">
          <div className="flex h-full flex-col overflow-hidden rounded-[8px] border border-[#3e1f49] bg-background">
            <div className="flex flex-1 overflow-hidden">
              <ErrorBoundary>
                <Outlet />
              </ErrorBoundary>
            </div>
            <div className="flex h-12 shrink-0 items-center border-t border-[#c7d7df] bg-[#e7f5fd] px-3 text-[14px] text-[#1f2528]">
              <span className="mr-2 text-[#8c7a35]">⚠</span>
              <span>Slack needs your permission to enable notifications.</span>
              <button className="ml-1 text-[#1264a3] hover:underline">Enable notifications</button>
              <button className="ml-auto text-[#5f6f76]">×</button>
            </div>
          </div>
        </div>
        <SearchCommandPalette />
        <KeyboardShortcutsHelp />
        <PhotoViewer />
      </TooltipProvider>
    </AppContext.Provider>
  );
}
