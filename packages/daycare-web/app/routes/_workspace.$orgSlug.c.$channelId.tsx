import { createRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { orgSlugRoute } from "./_workspace.$orgSlug";
import { useApp, useStorage } from "@/app/sync/AppContext";
import { messagesForChannel, typingUsersForChannel, presenceForUser } from "@/app/sync/selectors";
import { useUiStore } from "@/app/stores/uiStoreContext";
import { MessageRow } from "@/app/components/messages/MessageRow";
import { Composer } from "@/app/components/messages/Composer";
import { Hash, Lock, ArrowDown, Loader2, Settings } from "lucide-react";
import { MessageListSkeleton } from "@/app/components/skeletons/MessageListSkeleton";
import { Button } from "@/app/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip";
import { ChannelSettings } from "@/app/components/workspace/ChannelSettings";
import { useThrottledTyping } from "@/app/lib/useThrottledTyping";
import { typingTextFormat } from "@/app/lib/typingTextFormat";
import { useFileUpload } from "@/app/lib/useFileUpload";
import { useMessagePagination } from "@/app/lib/useMessagePagination";
import { cn } from "@/app/lib/utils";
import { lastEditableMessageFind } from "@/app/lib/lastEditableMessageFind";
import { messageGroupCheck } from "@/app/lib/messageGroupCheck";

export const channelRoute = createRoute({
  getParentRoute: () => orgSlugRoute,
  path: "c/$channelId",
  component: ChannelPage,
});

function ChannelPage() {
  const { channelId } = channelRoute.useParams();
  const { orgSlug } = orgSlugRoute.useParams();
  const navigate = useNavigate();
  const app = useApp();

  const channel = useStorage((s) => s.objects.channel[channelId]);
  const messages = useStorage(
    useShallow((s) => messagesForChannel(s.objects, channelId)),
  );
  const mutate = useStorage((s) => s.mutate);
  const userId = useStorage((s) => s.objects.context.userId);
  const presenceState = useStorage(useShallow((s) => s.objects.presence));
  const typingUsers = useStorage(
    useShallow((s) => typingUsersForChannel(s.objects, channelId, userId)),
  );

  const draft = useUiStore((s) => s.composerDrafts[channelId] ?? "");
  const composerDraftSet = useUiStore((s) => s.composerDraftSet);

  // File upload
  const fileUpload = useFileUpload(app.api, app.token, app.orgId);

  // Settings dialog
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Initial message loading state
  const [messagesLoaded, setMessagesLoaded] = useState(false);

  // Edit last own message (Up Arrow shortcut)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  const handleEditLastMessage = useCallback(() => {
    const id = lastEditableMessageFind(messages, userId);
    if (id) setEditingMessageId(id);
  }, [messages, userId]);

  const handleEditModeChange = useCallback((_messageId: string, editing: boolean) => {
    if (!editing) {
      setEditingMessageId(null);
    }
  }, []);

  // Drag-and-drop state
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);

  // Fetch messages when channel changes
  useEffect(() => {
    setMessagesLoaded(false);
    app.syncMessages(channelId).then(
      () => setMessagesLoaded(true),
      () => setMessagesLoaded(true),
    );
  }, [app, channelId]);

  // Sync presence for message senders
  const presenceSyncedRef = useRef<string>("");
  useEffect(() => {
    const senderIds = [...new Set(messages.map((m) => m.senderUserId))];
    const key = senderIds.sort().join(",");
    if (key === presenceSyncedRef.current || senderIds.length === 0) return;
    presenceSyncedRef.current = key;
    app.syncPresence(senderIds);
  }, [messages, app]);

  // Mark as read on channel select
  useEffect(() => {
    mutate("readMark", { chatId: channelId });
  }, [mutate, channelId]);

  // Pagination
  const pagination = useMessagePagination(app, channelId, messages);

  // Mark read on new messages while viewing
  const prevMessageCountRef = useRef(messages.length);
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current && pagination.isAtBottomRef.current) {
      mutate("readMark", { chatId: channelId });
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length, mutate, channelId, pagination.isAtBottomRef]);

  // Typing signal (throttled)
  const emitTyping = useThrottledTyping(app, channelId);

  // Send message with attachments
  const handleSend = useCallback(
    (text: string) => {
      const attachments = fileUpload.getReadyAttachments();
      const id = crypto.randomUUID();
      mutate("messageSend", {
        id,
        chatId: channelId,
        text,
        ...(attachments.length > 0 ? { attachments } : {}),
      });
      fileUpload.clear();
    },
    [mutate, channelId, fileUpload],
  );

  // Thread open
  const handleThreadOpen = useCallback(
    (messageId: string) => {
      navigate({
        to: "/$orgSlug/c/$channelId/t/$threadId",
        params: { orgSlug, channelId, threadId: messageId },
      });
    },
    [navigate, orgSlug, channelId],
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
      composerDraftSet(channelId, text);
    },
    [composerDraftSet, channelId],
  );

  // Channel updated (from settings dialog)
  const handleChannelUpdated = useCallback(() => {
    app.syncChannels();
  }, [app]);

  // Typing indicator text
  const typingText = useMemo(() => typingTextFormat(typingUsers), [typingUsers]);

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

        {/* Channel header */}
        <div className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-5">
          {channel?.visibility === "private" ? (
            <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <h2 className="font-display text-base font-semibold truncate">
            {channel?.name ?? "Channel"}
          </h2>
          {channel?.topic && (
            <>
              <span className="text-muted-foreground">--</span>
              <span className="text-sm text-muted-foreground truncate">
                {channel.topic}
              </span>
            </>
          )}
          <div className="ml-auto shrink-0">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setSettingsOpen(true)}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Channel settings</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
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

              {messages.length === 0 && !messagesLoaded ? (
                <MessageListSkeleton />
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-sm text-muted-foreground">
                    No messages yet. Start the conversation!
                  </p>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <MessageRow
                    key={msg.id}
                    message={msg}
                    currentUserId={userId}
                    presence={presenceForUser(presenceState, msg.senderUserId)}
                    startInEditMode={editingMessageId === msg.id}
                    isGroupContinuation={messageGroupCheck(messages[i - 1], msg)}
                    onThreadOpen={handleThreadOpen}
                    onReactionToggle={handleReactionToggle}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onEditModeChange={handleEditModeChange}
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
          onEditLastMessage={handleEditLastMessage}
          placeholder={
            channel ? `Message #${channel.name}` : "Type a message..."
          }
          uploadEntries={fileUpload.entries}
          onFilesSelected={fileUpload.addFiles}
          onFileRemove={fileUpload.removeFile}
          hasReadyAttachments={fileUpload.hasReady}
          isUploading={fileUpload.hasUploading}
        />
      </div>

      {/* Thread panel outlet */}
      <Outlet />

      {/* Channel settings dialog */}
      {channel && (
        <ChannelSettings
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          channelId={channelId}
          channelName={channel.name}
          channelTopic={channel.topic}
          channelVisibility={channel.visibility}
          currentUserId={userId}
          api={app.api}
          token={app.token}
          orgId={app.orgId}
          onChannelUpdated={handleChannelUpdated}
        />
      )}
    </div>
  );
}
