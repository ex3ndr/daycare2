import { createRoute, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { dmRoute } from "./_workspace.$orgSlug.dm.$dmId";
import { orgSlugRoute } from "./_workspace.$orgSlug";
import { ThreadPanel } from "@/app/components/threads/ThreadPanel";

export const dmThreadRoute = createRoute({
  getParentRoute: () => dmRoute,
  path: "t/$threadId",
  component: DmThreadRoute,
});

function DmThreadRoute() {
  const { threadId } = dmThreadRoute.useParams();
  const { dmId } = dmRoute.useParams();
  const { orgSlug } = orgSlugRoute.useParams();
  const navigate = useNavigate();

  const handleClose = useCallback(() => {
    navigate({
      to: "/$orgSlug/dm/$dmId",
      params: { orgSlug, dmId },
    });
  }, [navigate, orgSlug, dmId]);

  return (
    <ThreadPanel
      chatId={dmId}
      threadId={threadId}
      onClose={handleClose}
    />
  );
}
