import { createRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { chatLayoutRoute } from "./_workspace.$orgSlug._chat";
import { useApp, useStorage } from "@/app/sync/AppContext";
import { useConversation } from "@/app/components/conversation/useConversation";
import { ConversationTimeline } from "@/app/components/conversation/ConversationTimeline";
import { Composer } from "@/app/components/messages/Composer";
import { ChannelSettings } from "@/app/components/workspace/ChannelSettings";
import { Hash, Lock, Headphones, Bell, Search, MoreVertical, Star, Users, PencilLine, File as FileIcon } from "lucide-react";
import { cn } from "@/app/lib/utils";

export const channelRoute = createRoute({
  getParentRoute: () => chatLayoutRoute,
  path: "c/$channelId",
  component: ChannelPage,
});

function ChannelPage() {
  const { channelId } = channelRoute.useParams();
  const { orgSlug } = chatLayoutRoute.useParams();
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

        {/* Channel header */}
        <div className="shrink-0 border-b border-[#d8d8da] bg-background">
          <div className="flex h-[49px] items-center gap-2 border-b border-[#e7e7e8] px-4">
            <Star className="h-4 w-4 text-[#c5a84d]" />
            {channel?.visibility === "private" ? (
              <Lock className="h-4 w-4 text-[#6a6a6d] shrink-0" />
            ) : (
              <Hash className="h-4 w-4 text-[#6a6a6d] shrink-0" />
            )}
            <h2 className="font-display text-[20px] font-semibold truncate text-[#232325]">
              {channel?.name ?? "general"}
            </h2>
            <div className="ml-auto flex items-center gap-2 text-[#68696d]">
              <button className="flex h-6 items-center gap-1 rounded-full border border-[#d4d5d8] px-1.5 text-[11px]">
                <Users className="h-3.5 w-3.5" />
                2
              </button>
              <button className="flex h-6 w-6 items-center justify-center rounded hover:bg-[#f4f4f5]">
                <Headphones className="h-3.5 w-3.5" />
              </button>
              <button className="flex h-6 w-6 items-center justify-center rounded hover:bg-[#f4f4f5]">
                <Bell className="h-3.5 w-3.5" />
              </button>
              <button className="flex h-6 w-6 items-center justify-center rounded hover:bg-[#f4f4f5]">
                <Search className="h-3.5 w-3.5" />
              </button>
              <button
                className="flex h-6 w-6 items-center justify-center rounded hover:bg-[#f4f4f5]"
                onClick={() => setSettingsOpen(true)}
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="flex h-[38px] items-center gap-5 px-4 text-[13px] text-[#57585b]">
            <button className="flex items-center gap-1.5 h-full border-b-2 border-[#5a3368] font-semibold">
              <span className="inline-block h-2.5 w-2.5 rounded-[3px] bg-[#5a3368]" />
              Messages
            </button>
            <button className="flex items-center gap-1.5">
              <PencilLine className="h-3 w-3" />
              Add canvas
            </button>
            <button className="flex items-center gap-1.5">
              <FileIcon className="h-3 w-3" />
              Files
            </button>
            <button className="text-lg leading-none">+</button>
          </div>
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

        {conv.typingText && (
          <div className="h-6 px-5 flex items-center">
            <span className="text-xs text-muted-foreground animate-pulse">
              {conv.typingText}
            </span>
          </div>
        )}

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
      </div>

      <Outlet />

      {channel && (
        <ChannelSettings
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
    </div>
  );
}
