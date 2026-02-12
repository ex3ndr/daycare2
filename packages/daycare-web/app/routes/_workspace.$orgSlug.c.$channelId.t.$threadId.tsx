import { createRoute, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { channelRoute } from "./_workspace.$orgSlug.c.$channelId";
import { orgSlugRoute } from "./_workspace.$orgSlug";
import { ThreadPanel } from "@/app/components/threads/ThreadPanel";

export const threadRoute = createRoute({
  getParentRoute: () => channelRoute,
  path: "t/$threadId",
  component: ChannelThreadRoute,
});

function ChannelThreadRoute() {
  const { threadId } = threadRoute.useParams();
  const { channelId } = channelRoute.useParams();
  const { orgSlug } = orgSlugRoute.useParams();
  const navigate = useNavigate();

  const handleClose = useCallback(() => {
    navigate({
      to: "/$orgSlug/c/$channelId",
      params: { orgSlug, channelId },
    });
  }, [navigate, orgSlug, channelId]);

  return (
    <ThreadPanel
      chatId={channelId}
      threadId={threadId}
      onClose={handleClose}
    />
  );
}
