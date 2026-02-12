import { useCallback, useEffect, useRef, useState } from "react";
import type { AppController } from "@/app/sync/AppController";

export const PAGE_SIZE = 50;
export const SCROLL_TOP_THRESHOLD = 200;
export const SCROLL_BOTTOM_THRESHOLD = 100;

export function useMessagePagination(
  app: AppController,
  chatId: string,
  messages: Array<{ id: string; createdAt: number }>,
) {
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const loadingRef = useRef(false);

  // Reset pagination state when chat changes
  useEffect(() => {
    setHasMore(true);
    setIsLoadingOlder(false);
    setShowJumpToBottom(false);
    isAtBottomRef.current = true;
    loadingRef.current = false;
  }, [chatId]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
    });
  }, []);

  // Scroll to bottom on initial load and chat change
  useEffect(() => {
    scrollToBottom();
  }, [chatId, scrollToBottom]);

  // Auto-scroll on content resize when user is at bottom (e.g. new messages, images loading)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      if (isAtBottomRef.current) {
        scrollToBottom();
      }
    });

    // Observe the inner content area (first child) for size changes
    const content = container.firstElementChild;
    if (content) {
      observer.observe(content);
    }

    return () => observer.disconnect();
  }, [chatId, scrollToBottom]);

  const loadOlderMessages = useCallback(async () => {
    if (loadingRef.current || !hasMore || messages.length === 0) return;
    loadingRef.current = true;
    setIsLoadingOlder(true);

    const el = scrollContainerRef.current;
    const prevScrollHeight = el?.scrollHeight ?? 0;

    try {
      const oldestMessage = messages[0];
      const { fetchedCount } = await app.syncMessagesPage(chatId, {
        before: oldestMessage.id,
        limit: PAGE_SIZE,
      });

      if (fetchedCount < PAGE_SIZE) {
        setHasMore(false);
      }

      // Restore scroll position after new messages are prepended
      requestAnimationFrame(() => {
        if (el) {
          const newScrollHeight = el.scrollHeight;
          el.scrollTop += newScrollHeight - prevScrollHeight;
        }
      });
    } finally {
      setIsLoadingOlder(false);
      loadingRef.current = false;
    }
  }, [app, chatId, hasMore, messages]);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const distanceFromBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight;
    isAtBottomRef.current = distanceFromBottom < SCROLL_BOTTOM_THRESHOLD;

    setShowJumpToBottom(distanceFromBottom > SCROLL_BOTTOM_THRESHOLD * 3);

    if (el.scrollTop < SCROLL_TOP_THRESHOLD && hasMore && !loadingRef.current) {
      loadOlderMessages();
    }
  }, [hasMore, loadOlderMessages]);

  return {
    isLoadingOlder,
    hasMore,
    showJumpToBottom,
    scrollContainerRef,
    messagesEndRef,
    isAtBottomRef,
    handleScroll,
    scrollToBottom,
  };
}
