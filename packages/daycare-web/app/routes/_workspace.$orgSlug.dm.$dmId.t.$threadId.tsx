import { createRoute } from "@tanstack/react-router";
import { dmRoute } from "./_workspace.$orgSlug.dm.$dmId";

export const dmThreadRoute = createRoute({
  getParentRoute: () => dmRoute,
  path: "t/$threadId",
  component: DmThreadPanel,
});

function DmThreadPanel() {
  const { threadId } = dmThreadRoute.useParams();
  return (
    <div className="w-80 border-l">
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Thread {threadId} placeholder</p>
      </div>
    </div>
  );
}
