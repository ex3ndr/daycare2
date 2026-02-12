import React, { type RefObject } from "react";
import { MessageRow } from "@/app/components/messages/MessageRow";
import { FailedMessageRow } from "@/app/components/messages/FailedMessageRow";
import { MessageListSkeleton } from "@/app/components/skeletons/MessageListSkeleton";
import { ArrowDown, Loader2 } from "lucide-react";
import { presenceForUser } from "@/app/sync/selectors";
import { messageGroupCheck } from "@/app/lib/messageGroupCheck";

type Message = Parameters<typeof MessageRow>[0]["message"];
type FailedEntry = [string, Parameters<typeof FailedMessageRow>[0]["message"]];

export function ConversationTimeline({
  messages,
  messagesLoaded,
  failedMsgs,
  userId,
  presenceState,
  editingMessageId,
  pagination,
  onThreadOpen,
  onReactionToggle,
  onEdit,
  onDelete,
  onEditModeChange,
  onRetry,
  onDismiss,
}: {
  messages: Message[];
  messagesLoaded: boolean;
  failedMsgs: FailedEntry[];
  userId: string;
  presenceState: Record<string, { status: "online" | "away" | "offline" }>;
  editingMessageId: string | null;
  pagination: {
    scrollContainerRef: RefObject<HTMLDivElement | null>;
    messagesEndRef: RefObject<HTMLDivElement | null>;
    handleScroll: () => void;
    isLoadingOlder: boolean;
    hasMore: boolean;
    showJumpToBottom: boolean;
    scrollToBottom: () => void;
  };
  onThreadOpen?: (messageId: string) => void;
  onReactionToggle: (messageId: string, shortcode: string) => void;
  onEdit: (messageId: string, text: string) => void;
  onDelete: (messageId: string) => void;
  onEditModeChange: (messageId: string, editing: boolean) => void;
  onRetry: (failedId: string) => void;
  onDismiss: (failedId: string) => void;
}) {
  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        ref={pagination.scrollContainerRef as React.RefObject<HTMLDivElement>}
        onScroll={pagination.handleScroll}
        className="h-full overflow-y-auto"
      >
        <div className="py-4 flex flex-col min-h-full">
          <div className="flex-1" />

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
              <div key={msg.id} style={{ overflowAnchor: "none" }}>
                <MessageRow
                  message={msg}
                  currentUserId={userId}
                  presence={presenceForUser(presenceState, msg.sender.id)}
                  startInEditMode={editingMessageId === msg.id}
                  isGroupContinuation={messageGroupCheck(messages[i - 1], msg)}
                  onThreadOpen={onThreadOpen}
                  onReactionToggle={onReactionToggle}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onEditModeChange={onEditModeChange}
                />
              </div>
            ))
          )}
          {failedMsgs.map(([id, msg]) => (
            <FailedMessageRow
              key={id}
              id={id}
              message={msg}
              onRetry={onRetry}
              onDismiss={onDismiss}
            />
          ))}
          <div ref={pagination.messagesEndRef as React.RefObject<HTMLDivElement>} style={{ overflowAnchor: "auto" }} />
        </div>
      </div>

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
  );
}
