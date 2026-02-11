import { createRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { orgSlugRoute } from "./_workspace.$orgSlug";
import { useApp, useStorage } from "@/app/sync/AppContext";
import { Input } from "@/app/components/ui/input";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import { Separator } from "@/app/components/ui/separator";
import { Hash, Lock, Search, MessageSquare, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { searchHighlightParse } from "@/app/lib/searchHighlightParse";
import { timeFormat } from "@/app/lib/timeFormat";
import type { MessageSearchResult, ChannelSearchResult } from "@/app/daycare/types";

type SearchParams = {
  q?: string;
};

export const searchRoute = createRoute({
  getParentRoute: () => orgSlugRoute,
  path: "search",
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q } = searchRoute.useSearch();
  const { orgSlug } = orgSlugRoute.useParams();
  const navigate = useNavigate();
  const app = useApp();
  const orgId = useStorage((s) => s.objects.context.orgId);

  const [query, setQuery] = useState(q ?? "");
  const [messageResults, setMessageResults] = useState<MessageSearchResult[]>([]);
  const [channelResults, setChannelResults] = useState<ChannelSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Perform search when q param changes
  useEffect(() => {
    if (!q || q.trim().length < 2) {
      setMessageResults([]);
      setChannelResults([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    setSearched(true);

    Promise.all([
      app.api.searchMessages(app.token, orgId, { q, limit: 50 }),
      app.api.searchChannels(app.token, orgId, { q, limit: 20 }),
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
  }, [q, app.api, app.token, orgId]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!query.trim()) return;
      navigate({
        to: "/$orgSlug/search",
        params: { orgSlug },
        search: { q: query.trim() },
      });
    },
    [navigate, orgSlug, query],
  );

  const handleMessageClick = useCallback(
    (msg: MessageSearchResult) => {
      navigate({
        to: "/$orgSlug/c/$channelId",
        params: { orgSlug, channelId: msg.chatId },
      });
    },
    [navigate, orgSlug],
  );

  const handleChannelClick = useCallback(
    (ch: ChannelSearchResult) => {
      navigate({
        to: "/$orgSlug/c/$channelId",
        params: { orgSlug, channelId: ch.id },
      });
    },
    [navigate, orgSlug],
  );

  const handleBack = useCallback(() => {
    navigate({ to: "/$orgSlug", params: { orgSlug } });
  }, [navigate, orgSlug]);

  return (
    <div className="flex flex-1 flex-col min-w-0">
      {/* Search header */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b bg-background px-5">
        <Button variant="ghost" size="icon" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <h2 className="font-display text-base font-semibold">Search</h2>
      </div>

      {/* Search input */}
      <div className="border-b bg-background px-5 py-3">
        <form onSubmit={handleSubmit}>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search messages and channels..."
            autoFocus
          />
        </form>
      </div>

      {/* Results */}
      <ScrollArea className="flex-1">
        <div className="py-4 px-5">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && !searched && (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">
                Type a search query and press Enter
              </p>
            </div>
          )}

          {!loading && searched && messageResults.length === 0 && channelResults.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">
                No results found for &ldquo;{q}&rdquo;
              </p>
            </div>
          )}

          {/* Channel results */}
          {!loading && channelResults.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Channels
              </h3>
              <div className="space-y-1">
                {channelResults.map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => handleChannelClick(ch)}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm hover:bg-accent transition-colors text-left"
                  >
                    {ch.visibility === "private" ? (
                      <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <Hash className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{ch.name}</p>
                      {ch.topic && (
                        <p className="text-xs text-muted-foreground truncate">
                          {ch.topic}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Separator between sections */}
          {!loading && channelResults.length > 0 && messageResults.length > 0 && (
            <Separator className="mb-6" />
          )}

          {/* Message results */}
          {!loading && messageResults.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Messages
              </h3>
              <div className="space-y-1">
                {messageResults.map((msg) => (
                  <MessageSearchResultRow
                    key={msg.id}
                    message={msg}
                    onClick={() => handleMessageClick(msg)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function MessageSearchResultRow({
  message,
  onClick,
}: {
  message: MessageSearchResult;
  onClick: () => void;
}) {
  const segments = searchHighlightParse(message.highlight);

  return (
    <button
      onClick={onClick}
      className="flex w-full flex-col gap-1 rounded-md px-3 py-2.5 text-sm hover:bg-accent transition-colors text-left"
    >
      <div className="flex items-center gap-2">
        <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          {timeFormat(message.createdAt)}
        </span>
      </div>
      <p className="text-sm leading-relaxed">
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
    </button>
  );
}
