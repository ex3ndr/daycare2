import { useCallback, useEffect, useRef, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useApp, useStorage } from "@/app/sync/AppContext";
import { messagesForChannel, typingUsersForChannel, presenceForUser } from "@/app/sync/selectors";
import { useUiStore, failedMessageRemove } from "@/app/stores/uiStoreContext";
import { useThrottledTyping } from "@/app/lib/useThrottledTyping";
import { typingTextFormat } from "@/app/lib/typingTextFormat";
import { useFileUpload } from "@/app/lib/useFileUpload";
import { useMessagePagination } from "@/app/lib/useMessagePagination";
import { lastEditableMessageFind } from "@/app/lib/lastEditableMessageFind";
import { messageIdCreate } from "@/app/lib/messageIdCreate";

/**
 * Shared hook for channel and DM conversation pages.
 * Encapsulates message loading, sending, editing, reactions,
 * typing, drafts, pagination, drag-drop, and failed message handling.
 */
export function useConversation(chatId: string, extraPresenceUserIds?: string[]) {
  const app = useApp();

  const messages = useStorage(
    useShallow((s) => messagesForChannel(s.objects, chatId)),
  );
  const mutate = useStorage((s) => s.mutate);
  const userId = useStorage((s) => s.objects.context.userId);
  const presenceState = useStorage(useShallow((s) => s.objects.presence));
  const typingUsers = useStorage(
    useShallow((s) => typingUsersForChannel(s.objects, chatId, userId)),
  );

  const draft = useUiStore((s) => s.composerDrafts[chatId] ?? "");
  const composerDraftSet = useUiStore((s) => s.composerDraftSet);
  const failedMsgs = useUiStore(
    useShallow((s) =>
      Object.entries(s.failedMessages).filter(([, m]) => m.chatId === chatId),
    ),
  );

  const fileUpload = useFileUpload(app.api, app.token, app.orgId);

  const [messagesLoaded, setMessagesLoaded] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);

  // Fetch messages when chatId changes
  useEffect(() => {
    setMessagesLoaded(false);
    app.syncMessages(chatId).then(
      () => setMessagesLoaded(true),
      () => setMessagesLoaded(true),
    );
  }, [app, chatId]);

  // Sync presence for message senders (+ optional extra IDs for DM other user)
  const presenceSyncedRef = useRef<string>("");
  useEffect(() => {
    const senderIds = [...new Set(messages.map((m) => m.senderUserId))];
    if (extraPresenceUserIds) {
      for (const id of extraPresenceUserIds) {
        if (!senderIds.includes(id)) senderIds.push(id);
      }
    }
    const key = senderIds.sort().join(",");
    if (key === presenceSyncedRef.current || senderIds.length === 0) return;
    presenceSyncedRef.current = key;
    app.syncPresence(senderIds);
  }, [messages, extraPresenceUserIds, app]);

  // Mark as read on select
  useEffect(() => {
    mutate("readMark", { chatId });
  }, [mutate, chatId]);

  // Pagination
  const pagination = useMessagePagination(app, chatId, messages);

  // Mark read on new messages while viewing
  const prevMessageCountRef = useRef(messages.length);
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current && pagination.isAtBottomRef.current) {
      mutate("readMark", { chatId });
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length, mutate, chatId, pagination.isAtBottomRef]);

  // Typing
  const emitTyping = useThrottledTyping(app, chatId);
  const typingText = useMemo(() => typingTextFormat(typingUsers), [typingUsers]);

  // Handlers
  const handleEditLastMessage = useCallback(() => {
    const id = lastEditableMessageFind(messages, userId);
    if (id) setEditingMessageId(id);
  }, [messages, userId]);

  const handleEditModeChange = useCallback((_messageId: string, editing: boolean) => {
    if (!editing) setEditingMessageId(null);
  }, []);

  const handleSend = useCallback(
    (text: string) => {
      const attachments = fileUpload.getReadyAttachments();
      const id = messageIdCreate();
      mutate("messageSend", {
        id,
        chatId,
        text,
        ...(attachments.length > 0 ? { attachments } : {}),
      });
      fileUpload.clear();
    },
    [mutate, chatId, fileUpload],
  );

  const handleReactionToggle = useCallback(
    (messageId: string, shortcode: string) => {
      mutate("reactionToggle", { messageId, shortcode });
    },
    [mutate],
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

  const handleRetry = useCallback(
    (failedId: string) => {
      const msg = failedMsgs.find(([id]) => id === failedId)?.[1];
      if (!msg) return;
      failedMessageRemove(failedId);
      const id = messageIdCreate();
      mutate("messageSend", {
        id,
        chatId,
        text: msg.text,
        ...(msg.threadId ? { threadId: msg.threadId } : {}),
        ...(msg.attachments.length > 0 ? { attachments: msg.attachments } : {}),
      });
    },
    [failedMsgs, mutate, chatId],
  );

  const handleDismiss = useCallback((failedId: string) => {
    failedMessageRemove(failedId);
  }, []);

  const handleDraftChange = useCallback(
    (text: string) => {
      composerDraftSet(chatId, text);
    },
    [composerDraftSet, chatId],
  );

  // Drag-and-drop
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes("Files")) setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) setIsDragOver(false);
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
      if (files.length > 0) fileUpload.addFiles(files);
    },
    [fileUpload],
  );

  return {
    app,
    messages,
    mutate,
    userId,
    presenceState,
    presenceForUser,
    messagesLoaded,
    editingMessageId,
    isDragOver,
    draft,
    failedMsgs,
    fileUpload,
    pagination,
    emitTyping,
    typingText,
    handleEditLastMessage,
    handleEditModeChange,
    handleSend,
    handleReactionToggle,
    handleEdit,
    handleDelete,
    handleRetry,
    handleDismiss,
    handleDraftChange,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
  };
}
