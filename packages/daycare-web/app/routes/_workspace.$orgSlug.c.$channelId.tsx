import { createRoute, Outlet } from "@tanstack/react-router";
import { orgSlugRoute } from "./_workspace.$orgSlug";

export const channelRoute = createRoute({
  getParentRoute: () => orgSlugRoute,
  path: "c/$channelId",
  component: ChannelPage,
});

function ChannelPage() {
  const { channelId } = channelRoute.useParams();
  return (
    <div className="flex flex-1">
      <div className="flex flex-1 flex-col">
        <div className="flex flex-1 items-center justify-center">
          <p className="text-muted-foreground">Channel {channelId} placeholder</p>
        </div>
      </div>
      <Outlet />
    </div>
  );
}
