export function mentionUsernamesExtract(text: string): string[] {
  const matches = text.matchAll(/@([a-zA-Z0-9._-]+)/g);
  const usernames = new Set<string>();

  for (const match of matches) {
    const username = match[1]?.trim();
    if (username && username.length > 0) {
      usernames.add(username);
    }
  }

  return Array.from(usernames);
}
