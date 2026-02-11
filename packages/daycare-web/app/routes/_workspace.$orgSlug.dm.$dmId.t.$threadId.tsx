import { createRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useMemo } from "react";
import { dmRoute } from "./_workspace.$orgSlug.dm.$dmId";
import { orgSlugRoute } from "./_workspace.$orgSlug";
import { useApp, useStorage } from "@/app/sync/AppContext";
import { threadMessagesForRoot, typingUsersForChannel } from "@/app/sync/selectors";
import { useUiStore } from "@/app/stores/uiStoreContext";
import { MessageRow } from "@/app/components/messages/MessageRow";
import { Composer } from "@/app/components/messages/Composer";
import { X, MessageSquare } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import { useThrottledTyping } from "@/app/lib/useThrottledTyping";
import { typingTextFormat } from "@/app/lib/typingTextFormat";

export const dmThreadRoute = createRoute({
  getParentRoute: () => dmRoute,
  path: "t/$threadId",
  component: DmThreadPanel,
});

function DmThreadPanel() {
  const { threadId } = dmThreadRoute.useParams();
  const { dmId } = dmRoute.useParams();
  const { orgSlug } = orgSlugRoute.useParams();
  const navigate = useNavigate();
  const app = useApp();

  const rootMessage = useStorage((s) => s.objects.message[threadId]);
  const threadMessages = useStorage((s) => threadMessagesForRoot(s.objects, threadId));
  const mutate = useStorage((s) => s.mutate);
  const userId = useStorage((s) => s.objects.context.userId);
  const typingUsers = useStorage((s) =>
    typingUsersForChannel(s.objects, dmId, userId),
  );

  const draft = useUiStore((s) => s.threadComposerDrafts[threadId] ?? "");
  const threadComposerDraftSet = useUiStore((s) => s.threadComposerDraftSet);

  // Fetch thread messages on mount/change
  useEffect(() => {
    app.syncThreadMessages(dmId, threadId);
  }, [app, dmId, threadId]);

  // Auto-scroll to bottom
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [threadId, scrollToBottom]);

  useEffect(() => {
    if (isAtBottomRef.current) {
      scrollToBottom();
    }
  }, [threadMessages.length, scrollToBottom]);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const threshold = 100;
    isAtBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }, []);

  // Close thread panel -> navigate back to DM
  const handleClose = useCallback(() => {
    navigate({
      to: "/$orgSlug/dm/$dmId",
      params: { orgSlug, dmId },
    });
  }, [navigate, orgSlug, dmId]);

  // Send thread reply
  const handleSend = useCallback(
    (text: string) => {
      const id = crypto.randomUUID();
      mutate("messageSend", {
        id,
        chatId: dmId,
        text,
        threadId,
      });
    },
    [mutate, dmId, threadId],
  );

  // Draft change
  const handleDraftChange = useCallback(
    (text: string) => {
      threadComposerDraftSet(threadId, text);
    },
    [threadComposerDraftSet, threadId],
  );

  // Message edit
  const handleEdit = useCallback(
    (messageId: string, text: string) => {
      mutate("messageEdit", { id: messageId, text });
    },
    [mutate],
  );

  // Message delete
  const handleDelete = useCallback(
    (messageId: string) => {
      mutate("messageDelete", { id: messageId });
    },
    [mutate],
  );

  // Reaction toggle
  const handleReactionToggle = useCallback(
    (messageId: string, shortcode: string) => {
      mutate("reactionToggle", { messageId, shortcode });
    },
    [mutate],
  );

  // Typing signal for thread
  const emitTyping = useThrottledTyping(app, dmId);

  // Typing indicator text
  const typingText = useMemo(() => typingTextFormat(typingUsers), [typingUsers]);

  // Reply count
  const replyCount = threadMessages.length;

  return (
    <div className="flex w-80 shrink-0 flex-col border-l bg-background">
      {/* Thread header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-display text-sm font-semibold">Thread</h3>
          {replyCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {replyCount} {replyCount === 1 ? "reply" : "replies"}
            </span>
          )}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Close thread</TooltipContent>
        </Tooltip>
      </div>

      {/* Thread content */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
      >
        <div className="py-2">
          {/* Root message */}
          {rootMessage && (
            <>
              <MessageRow
                message={rootMessage}
                currentUserId={userId}
                onReactionToggle={handleReactionToggle}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
              {/* Separator between root and replies */}
              <div className="mx-5 my-2 border-t" />
              <div className="px-5 pb-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {replyCount} {replyCount === 1 ? "reply" : "replies"}
                </span>
              </div>
            </>
          )}

          {/* Thread replies */}
          {threadMessages.map((msg) => (
            <MessageRow
              key={msg.id}
              message={msg}
              currentUserId={userId}
              onReactionToggle={handleReactionToggle}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Typing indicator */}
      <div className="h-5 px-4 flex items-center">
        {typingText && (
          <span className="text-xs text-muted-foreground animate-pulse">
            {typingText}
          </span>
        )}
      </div>

      {/* Thread composer */}
      <Composer
        value={draft}
        onChange={handleDraftChange}
        onSend={handleSend}
        onTyping={emitTyping}
        placeholder="Reply in thread..."
      />
    </div>
  );
}
