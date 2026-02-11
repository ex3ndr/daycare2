import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import { timeFormat } from "@/app/lib/timeFormat";
import { cn } from "@/app/lib/utils";
import { MessageSquare, Loader2 } from "lucide-react";

export type MessageData = {
  id: string;
  text: string;
  createdAt: number;
  editedAt: number | null;
  deletedAt: number | null;
  threadReplyCount: number;
  threadLastReplyAt: number | null;
  sender: {
    id: string;
    kind: string;
    username: string;
    firstName: string;
    lastName: string | null;
    avatarUrl: string | null;
  };
  attachments: Array<{
    id: string;
    kind: string;
    url: string;
    mimeType: string | null;
    fileName: string | null;
    sizeBytes: number | null;
    sortOrder: number;
  }>;
  reactions: Array<{
    id: string;
    userId: string;
    shortcode: string;
    createdAt: number;
  }>;
  pending: boolean;
};

type MessageRowProps = {
  message: MessageData;
  currentUserId: string;
  onThreadOpen?: (messageId: string) => void;
  onReactionToggle?: (messageId: string, shortcode: string) => void;
};

function initialsFromSender(sender: MessageData["sender"]): string {
  const first = sender.firstName?.[0] ?? "";
  const last = sender.lastName?.[0] ?? "";
  if (first || last) return (first + last).toUpperCase();
  return (sender.username?.[0] ?? "?").toUpperCase();
}

function displayName(sender: MessageData["sender"]): string {
  const parts = [sender.firstName, sender.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : sender.username;
}

// Group reactions by shortcode with count and whether current user reacted
function groupReactions(
  reactions: MessageData["reactions"],
  currentUserId: string,
) {
  const map = new Map<string, { count: number; userReacted: boolean }>();
  for (const r of reactions) {
    const existing = map.get(r.shortcode);
    if (existing) {
      existing.count++;
      if (r.userId === currentUserId) existing.userReacted = true;
    } else {
      map.set(r.shortcode, {
        count: 1,
        userReacted: r.userId === currentUserId,
      });
    }
  }
  return map;
}

export function MessageRow({
  message,
  currentUserId,
  onThreadOpen,
  onReactionToggle,
}: MessageRowProps) {
  if (message.deletedAt) {
    return (
      <div className="flex gap-3 px-5 py-1.5 opacity-50">
        <div className="w-9 shrink-0" />
        <p className="text-sm italic text-muted-foreground">
          This message was deleted
        </p>
      </div>
    );
  }

  const sender = message.sender;
  const reactionGroups = groupReactions(message.reactions, currentUserId);

  return (
    <div
      className={cn(
        "group flex gap-3 px-5 py-1.5 hover:bg-accent/30 transition-colors",
        message.pending && "opacity-70",
      )}
    >
      <Avatar size="sm" className="mt-0.5 shrink-0">
        {sender.avatarUrl && <AvatarImage src={sender.avatarUrl} alt={displayName(sender)} />}
        <AvatarFallback>{initialsFromSender(sender)}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold truncate">
            {displayName(sender)}
          </span>
          {sender.username && (
            <span className="text-xs text-muted-foreground truncate">
              @{sender.username}
            </span>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs text-muted-foreground shrink-0 cursor-default">
                {timeFormat(message.createdAt)}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {new Date(message.createdAt).toLocaleString()}
            </TooltipContent>
          </Tooltip>
          {message.editedAt && (
            <span className="text-xs text-muted-foreground">(edited)</span>
          )}
          {message.pending && (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />
          )}
        </div>

        <p className="text-sm whitespace-pre-wrap break-words mt-0.5">
          {message.text}
        </p>

        {/* Reactions */}
        {reactionGroups.size > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {Array.from(reactionGroups.entries()).map(
              ([shortcode, { count, userReacted }]) => (
                <button
                  key={shortcode}
                  onClick={() => onReactionToggle?.(message.id, shortcode)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors hover:bg-accent",
                    userReacted
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground",
                  )}
                >
                  <span>{shortcode}</span>
                  <span className="font-medium">{count}</span>
                </button>
              ),
            )}
          </div>
        )}

        {/* Thread indicator */}
        {message.threadReplyCount > 0 && (
          <button
            onClick={() => onThreadOpen?.(message.id)}
            className="mt-1 flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>
              {message.threadReplyCount}{" "}
              {message.threadReplyCount === 1 ? "reply" : "replies"}
            </span>
            {message.threadLastReplyAt && (
              <span className="text-muted-foreground">
                — last {timeFormat(message.threadLastReplyAt)}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Hover actions */}
      <div className="flex items-start gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {onThreadOpen && message.threadReplyCount === 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onThreadOpen(message.id)}
              >
                <MessageSquare className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reply in thread</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
