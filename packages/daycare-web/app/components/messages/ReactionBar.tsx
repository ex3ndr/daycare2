import { cn } from "@/app/lib/utils";
import { shortcodeToEmoji } from "./emojiMap";
import { EmojiPicker } from "./EmojiPicker";

type Reaction = {
  id: string;
  userId: string;
  shortcode: string;
  createdAt: number;
};

type ReactionBarProps = {
  reactions: Reaction[];
  currentUserId: string;
  onToggle: (shortcode: string) => void;
};

// Group reactions by shortcode with count and whether current user reacted
export function groupReactions(
  reactions: Reaction[],
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

export function ReactionBar({ reactions, currentUserId, onToggle }: ReactionBarProps) {
  const groups = groupReactions(reactions, currentUserId);

  if (groups.size === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1 mt-1">
      {Array.from(groups.entries()).map(([shortcode, { count, userReacted }]) => (
        <button
          key={shortcode}
          onClick={() => onToggle(shortcode)}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors hover:bg-accent",
            userReacted
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border bg-background text-muted-foreground",
          )}
        >
          <span>{shortcodeToEmoji(shortcode)}</span>
          <span className="font-medium">{count}</span>
        </button>
      ))}
      <EmojiPicker onSelect={onToggle} />
    </div>
  );
}
