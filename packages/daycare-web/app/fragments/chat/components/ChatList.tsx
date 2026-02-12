import React, { type ReactNode, type RefObject } from "react";
import { StyleSheet, View } from "react-native";
import { ArrowDown, Loader2 } from "lucide-react";

type ChatListPagination = {
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  handleScroll: () => void;
  isLoadingOlder: boolean;
  hasMore: boolean;
  showJumpToBottom: boolean;
  scrollToBottom: () => void;
};

type ChatListProps = {
  pagination: ChatListPagination;
  hasMessages: boolean;
  children: ReactNode;
};

export function ChatList({ pagination, hasMessages, children }: ChatListProps) {
  return (
    <View style={styles.root}>
      <div
        ref={pagination.scrollContainerRef as React.RefObject<HTMLDivElement>}
        onScroll={pagination.handleScroll}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, overflowY: "auto" }}
      >
        <div className="py-4 flex flex-col min-h-full">
          <div className="flex-1" />

          {/* Fixed-height region for loading / beginning marker — prevents layout jump */}
          <div className="h-10 flex items-center justify-center">
            {pagination.isLoadingOlder ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : !pagination.hasMore && hasMessages ? (
              <p className="text-xs text-muted-foreground">
                Beginning of conversation
              </p>
            ) : null}
          </div>

          {children}

          <div
            ref={pagination.messagesEndRef as React.RefObject<HTMLDivElement>}
            style={{ overflowAnchor: "auto" }}
          />
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "relative",
    flex: 1,
    overflow: "hidden",
  },
});
