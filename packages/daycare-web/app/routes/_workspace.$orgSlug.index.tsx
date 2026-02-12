import { createRoute } from "@tanstack/react-router";
import { chatLayoutRoute } from "./_workspace.$orgSlug._chat";

// Index route for /:orgSlug — placeholder until channels are loaded
export const orgSlugIndexRoute = createRoute({
  getParentRoute: () => chatLayoutRoute,
  path: "/",
  component: OrgIndexPage,
});

function OrgIndexPage() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <p className="text-muted-foreground">Select a channel to start chatting</p>
    </div>
  );
}
