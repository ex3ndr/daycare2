import { createRoute } from "@tanstack/react-router";
import { chatLayoutRoute } from "./_workspace.$orgSlug._chat";
import { ChatDirect } from "@/app/fragments/chat/ChatDirect";

export const dmRoute = createRoute({
  getParentRoute: () => chatLayoutRoute,
  path: "dm/$dmId",
  component: DmRoute,
});

function DmRoute() {
  const { dmId } = dmRoute.useParams();
  const { orgSlug } = chatLayoutRoute.useParams();
  return <ChatDirect dmId={dmId} orgSlug={orgSlug} />;
}
