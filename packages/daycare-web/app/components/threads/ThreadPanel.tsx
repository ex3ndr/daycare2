import { useCallback, useEffect, useRef, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useApp, useStorage } from "@/app/sync/AppContext";
import { threadMessagesForRoot, typingUsersForChannel, presenceForUser } from "@/app/sync/selectors";
import { useUiStore } from "@/app/stores/uiStoreContext";
import { MessageRow } from "@/app/components/messages/MessageRow";
import { Composer } from "@/app/components/messages/Composer";
import { X, MessageSquare } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import { useThrottledTyping } from "@/app/lib/useThrottledTyping";
import { typingTextFormat } from "@/app/lib/typingTextFormat";
import { useFileUpload } from "@/app/lib/useFileUpload";
import { messageGroupCheck } from "@/app/lib/messageGroupCheck";
import { messageIdCreate } from "@/app/lib/messageIdCreate";

export function ThreadPanel({
  chatId,
  threadId,
  onClose,
}: {
  chatId: string;
  threadId: string;
  onClose: () => void;
}) {
  const app = useApp();

  const rootMessage = useStorage((s) => s.objects.message[threadId]);
  const threadMessages = useStorage(
    useShallow((s) => threadMessagesForRoot(s.objects, threadId)),
  );
  const mutate = useStorage((s) => s.mutate);
  const userId = useStorage((s) => s.objects.context.userId);
  const presenceState = useStorage(useShallow((s) => s.objects.presence));
  const typingUsers = useStorage(
    useShallow((s) => typingUsersForChannel(s.objects, chatId, userId)),
  );

  const draft = useUiStore((s) => s.threadComposerDrafts[threadId] ?? "");
  const threadComposerDraftSet = useUiStore((s) => s.threadComposerDraftSet);

  const fileUpload = useFileUpload(app.api, app.token, app.orgId);

  // Escape to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !e.defaultPrevented) {
        const active = document.activeElement;
        if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) return;
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Fetch thread messages
  useEffect(() => {
    app.syncThreadMessages(chatId, threadId);
  }, [app, chatId, threadId]);

  // Auto-scroll
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
    if (isAtBottomRef.current) scrollToBottom();
  }, [threadMessages.length, scrollToBottom]);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const threshold = 100;
    isAtBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }, []);

  // Send reply
  const handleSend = useCallback(
    (text: string) => {
      const attachments = fileUpload.getReadyAttachments();
      const id = messageIdCreate();
      mutate("messageSend", {
        id,
        chatId,
        text,
        threadId,
        ...(attachments.length > 0 ? { attachments } : {}),
      });
      fileUpload.clear();
    },
    [mutate, chatId, threadId, fileUpload],
  );

  const handleDraftChange = useCallback(
    (text: string) => {
      threadComposerDraftSet(threadId, text);
    },
    [threadComposerDraftSet, threadId],
  );

  const handleEdit = useCallback(
    (messageId: string, text: string) => {
      mutate("messageEdit", { id: messageId, text });
    },
    [mutate],
  );

  const handleDelete = useCallback(
    (messageId: string) => {
      mutate("messageDelete", { id: messageId });
    },
    [mutate],
  );

  const handleReactionToggle = useCallback(
    (messageId: string, shortcode: string) => {
      mutate("reactionToggle", { messageId, shortcode });
    },
    [mutate],
  );

  const emitTyping = useThrottledTyping(app, chatId);
  const typingText = useMemo(() => typingTextFormat(typingUsers), [typingUsers]);
  const replyCount = threadMessages.length;

  return (
    <div className="flex w-80 shrink-0 flex-col border-l bg-background">
      {/* Header */}
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
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Close thread</TooltipContent>
        </Tooltip>
      </div>

      {/* Content */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
      >
        <div className="py-2">
          {rootMessage && (
            <>
              <MessageRow
                message={rootMessage}
                currentUserId={userId}
                presence={presenceForUser(presenceState, rootMessage.senderUserId)}
                onReactionToggle={handleReactionToggle}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
              <div className="mx-5 my-2 border-t" />
              <div className="px-5 pb-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {replyCount} {replyCount === 1 ? "reply" : "replies"}
                </span>
              </div>
            </>
          )}

          {threadMessages.map((msg, i) => (
            <MessageRow
              key={msg.id}
              message={msg}
              currentUserId={userId}
              presence={presenceForUser(presenceState, msg.senderUserId)}
              isGroupContinuation={messageGroupCheck(threadMessages[i - 1], msg)}
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

      {/* Composer */}
      <Composer
        value={draft}
        onChange={handleDraftChange}
        onSend={handleSend}
        onTyping={emitTyping}
        placeholder="Reply in thread..."
        uploadEntries={fileUpload.entries}
        onFilesSelected={fileUpload.addFiles}
        onFileRemove={fileUpload.removeFile}
        hasReadyAttachments={fileUpload.hasReady}
        isUploading={fileUpload.hasUploading}
      />
    </div>
  );
}
