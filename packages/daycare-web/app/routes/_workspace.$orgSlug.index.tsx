import { createRoute } from "@tanstack/react-router";
import { orgSlugRoute } from "./_workspace.$orgSlug";

// Index route for /:orgSlug — placeholder until channels are loaded
export const orgSlugIndexRoute = createRoute({
  getParentRoute: () => orgSlugRoute,
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
