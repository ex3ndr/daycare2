import { useCallback, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Outlet, useNavigate } from "@tanstack/react-router";
import { useStorage } from "@/app/sync/AppContext";
import { presenceForUser } from "@/app/sync/selectors";
import { useShallow } from "zustand/react/shallow";
import { useConversation } from "@/app/components/conversation/useConversation";
import { ConversationTimeline } from "@/app/components/conversation/ConversationTimeline";
import { Composer } from "@/app/components/messages/Composer";
import { ChatList } from "./components/ChatList";
import { ChatDirectHeader } from "./components/ChatDirectHeader";
import { ChatTypingIndicator } from "./components/ChatTypingIndicator";
import { ChatDropZone } from "./components/ChatDropZone";

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
    <View style={styles.root}>
      <ChatDropZone
        isDragOver={conv.isDragOver}
        onDragEnter={conv.handleDragEnter}
        onDragLeave={conv.handleDragLeave}
        onDragOver={conv.handleDragOver}
        onDrop={conv.handleDrop}
      >
        <ChatDirectHeader
          displayName={displayName}
          initials={initials}
          avatarUrl={otherUser?.avatarUrl}
          presence={otherUser ? presenceForUser(presenceState, otherUser.id) : undefined}
        />

        <ChatList pagination={conv.pagination} hasMessages={conv.messages.length > 0}>
          <ConversationTimeline
            messages={conv.messages}
            messagesLoaded={conv.messagesLoaded}
            failedMsgs={conv.failedMsgs}
            userId={conv.userId}
            presenceState={conv.presenceState}
            editingMessageId={conv.editingMessageId}
            onThreadOpen={handleThreadOpen}
            onReactionToggle={conv.handleReactionToggle}
            onEdit={conv.handleEdit}
            onDelete={conv.handleDelete}
            onEditModeChange={conv.handleEditModeChange}
            onRetry={conv.handleRetry}
            onDismiss={conv.handleDismiss}
          />
        </ChatList>

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
      </ChatDropZone>

      <Outlet />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: "row",
    minWidth: 0,
  },
});
