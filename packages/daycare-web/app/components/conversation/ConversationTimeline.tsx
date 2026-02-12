import React from "react";
import { MessageRow } from "@/app/components/messages/MessageRow";
import { FailedMessageRow } from "@/app/components/messages/FailedMessageRow";
import { MessageListSkeleton } from "@/app/components/skeletons/MessageListSkeleton";
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
  onThreadOpen?: (messageId: string) => void;
  onReactionToggle: (messageId: string, shortcode: string) => void;
  onEdit: (messageId: string, text: string) => void;
  onDelete: (messageId: string) => void;
  onEditModeChange: (messageId: string, editing: boolean) => void;
  onRetry: (failedId: string) => void;
  onDismiss: (failedId: string) => void;
}) {
  return (
    <>
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
    </>
  );
}
