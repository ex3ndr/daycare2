import { createRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { orgSlugRoute } from "./_workspace.$orgSlug";
import { useApp, useStorage } from "@/app/sync/AppContext";
import { messagesForChannel, typingUsersForChannel } from "@/app/sync/selectors";
import { useUiStore } from "@/app/stores/uiStoreContext";
import { MessageRow } from "@/app/components/messages/MessageRow";
import { Composer } from "@/app/components/messages/Composer";
import { Hash, Lock } from "lucide-react";
import { useThrottledTyping } from "@/app/lib/useThrottledTyping";
import { typingTextFormat } from "@/app/lib/typingTextFormat";
import { useFileUpload } from "@/app/lib/useFileUpload";
import { cn } from "@/app/lib/utils";

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
  const typingUsers = useStorage(
    useShallow((s) => typingUsersForChannel(s.objects, channelId, userId)),
  );

  const draft = useUiStore((s) => s.composerDrafts[channelId] ?? "");
  const composerDraftSet = useUiStore((s) => s.composerDraftSet);

  // File upload
  const fileUpload = useFileUpload(app.api, app.token, app.orgId);

  // Drag-and-drop state
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);

  // Fetch messages when channel changes
  useEffect(() => {
    app.syncMessages(channelId);
  }, [app, channelId]);

  // Mark as read on channel select
  useEffect(() => {
    mutate("readMark", { chatId: channelId });
  }, [mutate, channelId]);

  // Auto-scroll to bottom
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
  }, []);

  // Scroll to bottom on initial load and channel change
  useEffect(() => {
    scrollToBottom();
  }, [channelId, scrollToBottom]);

  // Scroll to bottom on new messages if user is already at bottom
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
      mutate("readMark", { chatId: channelId });
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length, mutate, channelId]);

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
        text: text || " ",
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
    </div>
  );
}
