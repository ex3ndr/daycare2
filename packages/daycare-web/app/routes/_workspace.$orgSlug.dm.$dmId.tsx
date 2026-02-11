import { createRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { orgSlugRoute } from "./_workspace.$orgSlug";
import { useApp, useStorage } from "@/app/sync/AppContext";
import { messagesForChannel, typingUsersForChannel } from "@/app/sync/selectors";
import { useUiStore } from "@/app/stores/uiStoreContext";
import { MessageRow } from "@/app/components/messages/MessageRow";
import { Composer } from "@/app/components/messages/Composer";
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar";
import { useThrottledTyping } from "@/app/lib/useThrottledTyping";
import { typingTextFormat } from "@/app/lib/typingTextFormat";

export const dmRoute = createRoute({
  getParentRoute: () => orgSlugRoute,
  path: "dm/$dmId",
  component: DmPage,
});

function DmPage() {
  const { dmId } = dmRoute.useParams();
  const { orgSlug } = orgSlugRoute.useParams();
  const navigate = useNavigate();
  const app = useApp();

  const direct = useStorage((s) => s.objects.direct[dmId]);
  const messages = useStorage(
    useShallow((s) => messagesForChannel(s.objects, dmId)),
  );
  const mutate = useStorage((s) => s.mutate);
  const userId = useStorage((s) => s.objects.context.userId);
  const typingUsers = useStorage(
    useShallow((s) => typingUsersForChannel(s.objects, dmId, userId)),
  );

  const draft = useUiStore((s) => s.composerDrafts[dmId] ?? "");
  const composerDraftSet = useUiStore((s) => s.composerDraftSet);

  // Fetch messages when DM changes
  useEffect(() => {
    app.syncMessages(dmId);
  }, [app, dmId]);

  // Mark as read on DM select
  useEffect(() => {
    mutate("readMark", { chatId: dmId });
  }, [mutate, dmId]);

  // Auto-scroll to bottom
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [dmId, scrollToBottom]);

  useEffect(() => {
    if (isAtBottomRef.current) {
      scrollToBottom();
    }
  }, [messages.length, scrollToBottom]);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const threshold = 100;
    isAtBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }, []);

  // Mark read on new messages while viewing
  const prevMessageCountRef = useRef(messages.length);
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current && isAtBottomRef.current) {
      mutate("readMark", { chatId: dmId });
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length, mutate, dmId]);

  // Typing signal (throttled)
  const emitTyping = useThrottledTyping(app, dmId);

  // Send message
  const handleSend = useCallback(
    (text: string) => {
      const id = crypto.randomUUID();
      mutate("messageSend", {
        id,
        chatId: dmId,
        text,
      });
    },
    [mutate, dmId],
  );

  // Thread open
  const handleThreadOpen = useCallback(
    (messageId: string) => {
      navigate({
        to: "/$orgSlug/dm/$dmId/t/$threadId",
        params: { orgSlug, dmId, threadId: messageId },
      });
    },
    [navigate, orgSlug, dmId],
  );

  // Reaction toggle
  const handleReactionToggle = useCallback(
    (messageId: string, shortcode: string) => {
      mutate("reactionToggle", { messageId, shortcode });
    },
    [mutate],
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

  // Draft change
  const handleDraftChange = useCallback(
    (text: string) => {
      composerDraftSet(dmId, text);
    },
    [composerDraftSet, dmId],
  );

  // Typing indicator text
  const typingText = useMemo(() => typingTextFormat(typingUsers), [typingUsers]);

  // Other user info from the direct collection
  const otherUser = direct?.otherUser;
  const displayName = otherUser
    ? otherUser.lastName
      ? `${otherUser.firstName} ${otherUser.lastName}`
      : otherUser.firstName
    : "Direct Message";
  const initials = otherUser
    ? (otherUser.firstName[0] ?? "") + (otherUser.lastName?.[0] ?? "")
    : "?";

  return (
    <div className="flex flex-1 min-w-0">
      <div className="flex flex-1 flex-col min-w-0">
        {/* DM header */}
        <div className="flex h-14 shrink-0 items-center gap-3 border-b bg-background px-5">
          <Avatar size="sm">
            {otherUser?.avatarUrl && (
              <AvatarImage src={otherUser.avatarUrl} alt={displayName} />
            )}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <h2 className="font-display text-base font-semibold truncate">
            {displayName}
          </h2>
        </div>

        {/* Message list */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto"
        >
          <div className="py-4">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-muted-foreground">
                  No messages yet. Start the conversation!
                </p>
              </div>
            ) : (
              messages.map((msg) => (
                <MessageRow
                  key={msg.id}
                  message={msg}
                  currentUserId={userId}
                  onThreadOpen={handleThreadOpen}
                  onReactionToggle={handleReactionToggle}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Typing indicator */}
        <div className="h-6 px-5 flex items-center">
          {typingText && (
            <span className="text-xs text-muted-foreground animate-pulse">
              {typingText}
            </span>
          )}
        </div>

        {/* Composer */}
        <Composer
          value={draft}
          onChange={handleDraftChange}
          onSend={handleSend}
          onTyping={emitTyping}
          placeholder={`Message ${displayName}`}
        />
      </div>

      {/* Thread panel outlet */}
      <Outlet />
    </div>
  );
}
