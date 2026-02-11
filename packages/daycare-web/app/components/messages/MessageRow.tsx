import { useState, useRef, useEffect, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar";
import { Button } from "@/app/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { timeFormat } from "@/app/lib/timeFormat";
import { cn } from "@/app/lib/utils";
import { MessageSquare, Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { ReactionBar } from "./ReactionBar";
import { EmojiPicker } from "./EmojiPicker";
import { AttachmentList } from "./Attachment";

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
  presence?: "online" | "away" | "offline" | null;
  onThreadOpen?: (messageId: string) => void;
  onReactionToggle?: (messageId: string, shortcode: string) => void;
  onEdit?: (messageId: string, text: string) => void;
  onDelete?: (messageId: string) => void;
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

export function MessageRow({
  message,
  currentUserId,
  presence,
  onThreadOpen,
  onReactionToggle,
  onEdit,
  onDelete,
}: MessageRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  const isOwnMessage = message.sender.id === currentUserId;

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && editTextareaRef.current) {
      editTextareaRef.current.focus();
      editTextareaRef.current.selectionStart = editTextareaRef.current.value.length;
    }
  }, [isEditing]);

  const handleEditStart = useCallback(() => {
    setEditText(message.text);
    setIsEditing(true);
  }, [message.text]);

  const handleEditCancel = useCallback(() => {
    setIsEditing(false);
    setEditText("");
  }, []);

  const handleEditSave = useCallback(() => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== message.text) {
      onEdit?.(message.id, trimmed);
    }
    setIsEditing(false);
    setEditText("");
  }, [editText, message.id, message.text, onEdit]);

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleEditSave();
      } else if (e.key === "Escape") {
        handleEditCancel();
      }
    },
    [handleEditSave, handleEditCancel],
  );

  const handleDeleteConfirm = useCallback(() => {
    onDelete?.(message.id);
    setShowDeleteDialog(false);
  }, [onDelete, message.id]);

  // Auto-resize edit textarea
  const handleEditTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setEditText(e.target.value);
      e.target.style.height = "auto";
      e.target.style.height = `${e.target.scrollHeight}px`;
    },
    [],
  );

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
  const showContextMenu = isOwnMessage && (onEdit || onDelete) && !message.pending;

  const handleReaction = useCallback(
    (shortcode: string) => {
      onReactionToggle?.(message.id, shortcode);
    },
    [onReactionToggle, message.id],
  );

  return (
    <>
      <div
        className={cn(
          "group flex gap-3 px-5 py-1.5 hover:bg-accent/30 transition-colors",
          message.pending && "opacity-70",
          isEditing && "bg-accent/20",
        )}
      >
        <Avatar size="sm" className="mt-0.5 shrink-0" presence={presence}>
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

          {isEditing ? (
            <div className="mt-1">
              <textarea
                ref={editTextareaRef}
                value={editText}
                onChange={handleEditTextChange}
                onKeyDown={handleEditKeyDown}
                className="w-full resize-none overflow-hidden rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                rows={1}
              />
              <div className="mt-1 flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleEditCancel}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleEditSave}
                  disabled={!editText.trim() || editText.trim() === message.text}
                >
                  Save
                </Button>
                <span className="text-xs text-muted-foreground">
                  Enter to save, Esc to cancel
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm whitespace-pre-wrap break-words mt-0.5">
              {message.text}
            </p>
          )}

          {/* Attachments */}
          <AttachmentList attachments={message.attachments} />

          {/* Reactions */}
          {onReactionToggle && (
            <ReactionBar
              reactions={message.reactions}
              currentUserId={currentUserId}
              onToggle={handleReaction}
            />
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
          {onReactionToggle && !message.pending && (
            <EmojiPicker onSelect={handleReaction} variant="icon" />
          )}

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

          {showContextMenu && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                {onEdit && (
                  <DropdownMenuItem onClick={handleEditStart}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                )}
                {onEdit && onDelete && <DropdownMenuSeparator />}
                {onDelete && (
                  <DropdownMenuItem
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete message</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this message? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-muted/50 p-3">
            <p className="text-sm whitespace-pre-wrap break-words line-clamp-3">
              {message.text}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
