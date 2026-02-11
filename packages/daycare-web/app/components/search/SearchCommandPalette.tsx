import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/app/components/ui/command";
import { Hash, Lock, MessageSquare, Search } from "lucide-react";
import { useApp, useStorage } from "@/app/sync/AppContext";
import { useUiStore } from "@/app/stores/uiStoreContext";
import { searchHighlightParse } from "@/app/lib/searchHighlightParse";
import { timeFormat } from "@/app/lib/timeFormat";
import type { MessageSearchResult, ChannelSearchResult } from "@/app/daycare/types";

export function SearchCommandPalette() {
  const navigate = useNavigate();
  const app = useApp();
  const orgId = useStorage((s) => s.objects.context.orgId);
  const orgSlug = useStorage((s) => s.objects.context.orgSlug);
  const searchOpen = useUiStore((s) => s.searchOpen);
  const searchToggle = useUiStore((s) => s.searchToggle);
  const searchClose = useUiStore((s) => s.searchClose);
  const searchQuerySet = useUiStore((s) => s.searchQuerySet);
  const searchQuery = useUiStore((s) => s.searchQuery);

  const [messageResults, setMessageResults] = useState<MessageSearchResult[]>([]);
  const [channelResults, setChannelResults] = useState<ChannelSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cmd+K / Ctrl+K keyboard shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchToggle();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [searchToggle]);

  // Debounced search on query change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!searchQuery || searchQuery.trim().length < 2) {
      setMessageResults([]);
      setChannelResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(() => {
      const q = searchQuery.trim();
      Promise.all([
        app.api.searchMessages(app.token, orgId, { q, limit: 5 }),
        app.api.searchChannels(app.token, orgId, { q, limit: 5 }),
      ])
        .then(([msgResult, chResult]) => {
          setMessageResults(msgResult.messages);
          setChannelResults(chResult.channels);
        })
        .catch(() => {
          setMessageResults([]);
          setChannelResults([]);
        })
        .finally(() => setLoading(false));
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, app.api, app.token, orgId]);

  // Clear results when closing
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        searchClose();
        setMessageResults([]);
        setChannelResults([]);
      }
    },
    [searchClose],
  );

  const handleChannelSelect = useCallback(
    (channelId: string) => {
      searchClose();
      navigate({
        to: "/$orgSlug/c/$channelId",
        params: { orgSlug, channelId },
      });
    },
    [navigate, orgSlug, searchClose],
  );

  const handleMessageSelect = useCallback(
    (msg: MessageSearchResult) => {
      searchClose();
      navigate({
        to: "/$orgSlug/c/$channelId",
        params: { orgSlug, channelId: msg.chatId },
      });
    },
    [navigate, orgSlug, searchClose],
  );

  const handleSearchAll = useCallback(() => {
    if (!searchQuery.trim()) return;
    searchClose();
    navigate({
      to: "/$orgSlug/search",
      params: { orgSlug },
      search: { q: searchQuery.trim() },
    });
  }, [navigate, orgSlug, searchQuery, searchClose]);

  const hasResults = channelResults.length > 0 || messageResults.length > 0;
  const emptyMessage = loading
    ? "Searching..."
    : searchQuery.trim().length < 2
      ? "Type at least 2 characters to search..."
      : "No results found.";

  return (
    <CommandDialog open={searchOpen} onOpenChange={handleOpenChange}>
      <CommandInput
        placeholder="Search messages and channels..."
        value={searchQuery}
        onValueChange={searchQuerySet}
      />
      <CommandList>
        <CommandEmpty>{emptyMessage}</CommandEmpty>

        {/* Channel results */}
        {channelResults.length > 0 && (
          <CommandGroup heading="Channels">
            {channelResults.map((ch) => (
              <CommandItem
                key={`ch-${ch.id}`}
                value={`channel-${ch.name}-${ch.id}`}
                onSelect={() => handleChannelSelect(ch.id)}
                className="flex items-center gap-3"
              >
                {ch.visibility === "private" ? (
                  <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <Hash className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <span className="font-medium">{ch.name}</span>
                  {ch.topic && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {ch.topic}
                    </span>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {channelResults.length > 0 && messageResults.length > 0 && (
          <CommandSeparator />
        )}

        {/* Message results */}
        {messageResults.length > 0 && (
          <CommandGroup heading="Messages">
            {messageResults.map((msg) => {
              const segments = searchHighlightParse(msg.highlight);
              return (
                <CommandItem
                  key={`msg-${msg.id}`}
                  value={`message-${msg.text.slice(0, 40)}-${msg.id}`}
                  onSelect={() => handleMessageSelect(msg)}
                  className="flex flex-col items-start gap-1"
                >
                  <div className="flex items-center gap-2 w-full">
                    <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {timeFormat(msg.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm">
                    {segments.map((seg, i) =>
                      seg.highlighted ? (
                        <mark
                          key={i}
                          className="bg-primary/20 text-foreground rounded-sm px-0.5"
                        >
                          {seg.text}
                        </mark>
                      ) : (
                        <span key={i}>{seg.text}</span>
                      ),
                    )}
                  </p>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {/* "View all results" option */}
        {hasResults && searchQuery.trim().length >= 2 && (
          <>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                value="search-all-results"
                onSelect={handleSearchAll}
                className="flex items-center gap-2"
              >
                <Search className="h-4 w-4 text-muted-foreground" />
                <span>View all results for &ldquo;{searchQuery.trim()}&rdquo;</span>
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
