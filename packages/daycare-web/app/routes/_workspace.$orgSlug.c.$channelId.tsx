import { createRoute } from "@tanstack/react-router";
import { chatLayoutRoute } from "./_workspace.$orgSlug._chat";
import { ChatChannel } from "@/app/fragments/chat/ChatChannel";

export const channelRoute = createRoute({
  getParentRoute: () => chatLayoutRoute,
  path: "c/$channelId",
  component: ChannelRoute,
});

function ChannelRoute() {
  const { channelId } = channelRoute.useParams();
  const { orgSlug } = chatLayoutRoute.useParams();
  return <ChatChannel channelId={channelId} orgSlug={orgSlug} />;
}
