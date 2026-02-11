import type { MessageData } from "@/app/components/messages/MessageRow";

const GROUP_WINDOW_MS = 5 * 60 * 1000;

export function messageGroupCheck(
  prev: MessageData | undefined,
  current: MessageData,
): boolean {
  if (!prev) return false;
  if (prev.sender.id !== current.sender.id) return false;
  if (prev.deletedAt) return false;
  if (current.createdAt - prev.createdAt >= GROUP_WINDOW_MS) return false;
  if (prev.threadReplyCount > 0) return false;
  return true;
}
