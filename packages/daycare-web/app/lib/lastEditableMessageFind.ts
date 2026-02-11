type MessageLike = {
  id: string;
  senderUserId: string;
  deletedAt: number | null;
};

/**
 * Find the last message sent by the current user that can be edited.
 * Returns the message ID, or null if none found.
 */
export function lastEditableMessageFind(
  messages: MessageLike[],
  currentUserId: string,
): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.senderUserId === currentUserId && !msg.deletedAt) {
      return msg.id;
    }
  }
  return null;
}
