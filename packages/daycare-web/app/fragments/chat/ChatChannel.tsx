import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Outlet, useNavigate } from "@tanstack/react-router";
import { useApp, useStorage } from "@/app/sync/AppContext";
import { useConversation } from "@/app/components/conversation/useConversation";
import { ConversationTimeline } from "@/app/components/conversation/ConversationTimeline";
import { Composer } from "@/app/components/messages/Composer";
import { WorkspaceChannelSettings } from "@/app/fragments/workspace/WorkspaceChannelSettings";
import { ChatList } from "./components/ChatList";
import { ChatChannelHeader } from "./components/ChatChannelHeader";
import { ChatTypingIndicator } from "./components/ChatTypingIndicator";
import { ChatDropZone } from "./components/ChatDropZone";

export function ChatChannel({
  channelId,
  orgSlug,
}: {
  channelId: string;
  orgSlug: string;
}) {
  const navigate = useNavigate();
  const app = useApp();
  const channel = useStorage((s) => s.objects.channel[channelId]);
  const conv = useConversation(channelId);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleThreadOpen = useCallback(
    (messageId: string) => {
      navigate({
        to: "/$orgSlug/c/$channelId/t/$threadId",
        params: { orgSlug, channelId, threadId: messageId },
      });
    },
    [navigate, orgSlug, channelId],
  );

  const handleChannelUpdated = useCallback(() => {
    app.syncChannels();
  }, [app]);

  return (
    <View style={styles.root}>
      <ChatDropZone
        isDragOver={conv.isDragOver}
        onDragEnter={conv.handleDragEnter}
        onDragLeave={conv.handleDragLeave}
        onDragOver={conv.handleDragOver}
        onDrop={conv.handleDrop}
      >
        <ChatChannelHeader
          channelName={channel?.name ?? "general"}
          channelVisibility={channel?.visibility ?? "public"}
          onSettingsOpen={() => setSettingsOpen(true)}
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
          placeholder={channel ? `Message #${channel.name}` : "Type a message..."}
          uploadEntries={conv.fileUpload.entries}
          onFilesSelected={conv.fileUpload.addFiles}
          onFileRemove={conv.fileUpload.removeFile}
          hasReadyAttachments={conv.fileUpload.hasReady}
          isUploading={conv.fileUpload.hasUploading}
        />
      </ChatDropZone>

      <Outlet />

      {channel && (
        <WorkspaceChannelSettings
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          channelId={channelId}
          channelName={channel.name}
          channelTopic={channel.topic}
          channelVisibility={channel.visibility}
          currentUserId={conv.userId}
          api={app.api}
          token={app.token}
          orgId={app.orgId}
          onChannelUpdated={handleChannelUpdated}
        />
      )}
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
