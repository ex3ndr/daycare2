import { createRoute } from "@tanstack/react-router";
import { channelRoute } from "./_workspace.$orgSlug.c.$channelId";

export const threadRoute = createRoute({
  getParentRoute: () => channelRoute,
  path: "t/$threadId",
  component: ThreadPanel,
});

function ThreadPanel() {
  const { threadId } = threadRoute.useParams();
  return (
    <div className="w-80 border-l">
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Thread {threadId} placeholder</p>
      </div>
    </div>
  );
}
