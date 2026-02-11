import { createRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { orgSlugRoute } from "./_workspace.$orgSlug";
import { useApp, useStorage } from "@/app/sync/AppContext";
import { messagesForChannel, typingUsersForChannel } from "@/app/sync/selectors";
import { useUiStore } from "@/app/stores/uiStoreContext";
import { MessageRow } from "@/app/components/messages/MessageRow";
import { Composer } from "@/app/components/messages/Composer";
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar";
import { ArrowDown, Loader2 } from "lucide-react";
import { useThrottledTyping } from "@/app/lib/useThrottledTyping";
import { typingTextFormat } from "@/app/lib/typingTextFormat";
import { useFileUpload } from "@/app/lib/useFileUpload";
import { useMessagePagination } from "@/app/lib/useMessagePagination";
import { cn } from "@/app/lib/utils";

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

  // File upload
  const fileUpload = useFileUpload(app.api, app.token, app.orgId);

  // Drag-and-drop state
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);

  // Fetch messages when DM changes
  useEffect(() => {
    app.syncMessages(dmId);
  }, [app, dmId]);

  // Mark as read on DM select
  useEffect(() => {
    mutate("readMark", { chatId: dmId });
  }, [mutate, dmId]);

  // Pagination
  const pagination = useMessagePagination(app, dmId, messages);

  // Mark read on new messages while viewing
  const prevMessageCountRef = useRef(messages.length);
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current && pagination.isAtBottomRef.current) {
      mutate("readMark", { chatId: dmId });
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length, mutate, dmId, pagination.isAtBottomRef]);

  // Typing signal (throttled)
  const emitTyping = useThrottledTyping(app, dmId);

  // Send message with attachments
  const handleSend = useCallback(
    (text: string) => {
      const attachments = fileUpload.getReadyAttachments();
      const id = crypto.randomUUID();
      mutate("messageSend", {
        id,
        chatId: dmId,
        text: text || " ",
        ...(attachments.length > 0 ? { attachments } : {}),
      });
      fileUpload.clear();
    },
    [mutate, dmId, fileUpload],
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

  // Drag-and-drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        fileUpload.addFiles(files);
      }
    },
    [fileUpload],
  );

  return (
    <div className="flex flex-1 min-w-0">
      <div
        className={cn(
          "flex flex-1 flex-col min-w-0 relative",
          isDragOver && "ring-2 ring-primary ring-inset",
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Drag overlay */}
        {isDragOver && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-primary/10 pointer-events-none">
            <div className="rounded-lg border-2 border-dashed border-primary bg-background/80 px-8 py-6">
              <p className="text-sm font-medium text-primary">
                Drop files to upload
              </p>
            </div>
          </div>
        )}

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
        <div className="relative flex-1 overflow-hidden">
          <div
            ref={pagination.scrollContainerRef}
            onScroll={pagination.handleScroll}
            className="h-full overflow-y-auto"
          >
            <div className="py-4">
              {/* Loading spinner at top */}
              {pagination.isLoadingOlder && (
                <div className="flex items-center justify-center py-3">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}

              {!pagination.hasMore && messages.length > 0 && (
                <div className="flex items-center justify-center py-3">
                  <p className="text-xs text-muted-foreground">
                    Beginning of conversation
                  </p>
                </div>
              )}

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
              <div ref={pagination.messagesEndRef} />
            </div>
          </div>

          {/* Jump to bottom button */}
          {pagination.showJumpToBottom && (
            <button
              onClick={pagination.scrollToBottom}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-background/95 border shadow-md px-4 py-2 text-sm font-medium text-foreground hover:bg-background transition-colors"
            >
              <ArrowDown className="h-4 w-4" />
              Jump to latest
            </button>
          )}
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
          uploadEntries={fileUpload.entries}
          onFilesSelected={fileUpload.addFiles}
          onFileRemove={fileUpload.removeFile}
          hasReadyAttachments={fileUpload.hasReady}
          isUploading={fileUpload.hasUploading}
        />
      </div>

      {/* Thread panel outlet */}
      <Outlet />
    </div>
  );
}
