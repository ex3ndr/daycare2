// Format typing users into a human-readable string
export function typingTextFormat(
  typingUsers: Array<{ firstName: string }>,
): string | null {
  if (typingUsers.length === 0) return null;
  if (typingUsers.length === 1)
    return `${typingUsers[0].firstName} is typing...`;
  if (typingUsers.length === 2)
    return `${typingUsers[0].firstName} and ${typingUsers[1].firstName} are typing...`;
  return `${typingUsers[0].firstName} and ${typingUsers.length - 1} others are typing...`;
}
