import { useCallback, useMemo } from "react";
import { Outlet, useNavigate } from "@tanstack/react-router";
import { useStorage } from "@/app/sync/AppContext";
import { presenceForUser } from "@/app/sync/selectors";
import { useShallow } from "zustand/react/shallow";
import { useConversation } from "@/app/components/conversation/useConversation";
import { ConversationTimeline } from "@/app/components/conversation/ConversationTimeline";
import { Composer } from "@/app/components/messages/Composer";
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar";
import { ChatTypingIndicator } from "./components/ChatTypingIndicator";
import { cn } from "@/app/lib/utils";

export function ChatDirect({
  dmId,
  orgSlug,
}: {
  dmId: string;
  orgSlug: string;
}) {
  const navigate = useNavigate();
  const direct = useStorage((s) => s.objects.direct[dmId]);
  const presenceState = useStorage(useShallow((s) => s.objects.presence));

  const otherUser = direct?.otherUser;
  const displayName = otherUser
    ? otherUser.lastName
      ? `${otherUser.firstName} ${otherUser.lastName}`
      : otherUser.firstName
    : "Direct Message";
  const initials = otherUser
    ? (otherUser.firstName[0] ?? "") + (otherUser.lastName?.[0] ?? "")
    : "?";

  const extraPresenceIds = useMemo(
    () => (otherUser ? [otherUser.id] : undefined),
    [otherUser],
  );

  const conv = useConversation(dmId, extraPresenceIds);

  const handleThreadOpen = useCallback(
    (messageId: string) => {
      navigate({
        to: "/$orgSlug/dm/$dmId/t/$threadId",
        params: { orgSlug, dmId, threadId: messageId },
      });
    },
    [navigate, orgSlug, dmId],
  );

  return (
    <div className="flex flex-1 min-w-0">
      <div
        className={cn(
          "flex flex-1 flex-col min-w-0 relative",
          conv.isDragOver && "ring-2 ring-primary ring-inset",
        )}
        onDragEnter={conv.handleDragEnter}
        onDragLeave={conv.handleDragLeave}
        onDragOver={conv.handleDragOver}
        onDrop={conv.handleDrop}
      >
        {conv.isDragOver && (
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
          <Avatar size="sm" presence={otherUser ? presenceForUser(presenceState, otherUser.id) : undefined}>
            {otherUser?.avatarUrl && (
              <AvatarImage src={otherUser.avatarUrl} alt={displayName} />
            )}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <h2 className="font-display text-base font-semibold truncate">
            {displayName}
          </h2>
        </div>

        <ConversationTimeline
          messages={conv.messages}
          messagesLoaded={conv.messagesLoaded}
          failedMsgs={conv.failedMsgs}
          userId={conv.userId}
          presenceState={conv.presenceState}
          editingMessageId={conv.editingMessageId}
          pagination={conv.pagination}
          onThreadOpen={handleThreadOpen}
          onReactionToggle={conv.handleReactionToggle}
          onEdit={conv.handleEdit}
          onDelete={conv.handleDelete}
          onEditModeChange={conv.handleEditModeChange}
          onRetry={conv.handleRetry}
          onDismiss={conv.handleDismiss}
        />

        <ChatTypingIndicator text={conv.typingText} />

        <Composer
          value={conv.draft}
          onChange={conv.handleDraftChange}
          onSend={conv.handleSend}
          onTyping={conv.emitTyping}
          onEditLastMessage={conv.handleEditLastMessage}
          placeholder={`Message ${displayName}`}
          uploadEntries={conv.fileUpload.entries}
          onFilesSelected={conv.fileUpload.addFiles}
          onFileRemove={conv.fileUpload.removeFile}
          hasReadyAttachments={conv.fileUpload.hasReady}
          isUploading={conv.fileUpload.hasUploading}
        />
      </div>

      <Outlet />
    </div>
  );
}
