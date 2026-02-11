import type { SyncEngine } from "@slopus/sync";
import type { Schema } from "./schema";

type State = SyncEngine<Schema>["state"];

export function channelsForCurrentOrg(state: State) {
  const orgId = state.context.orgId;
  return Object.values(state.channel).filter(
    (ch) => ch.organizationId === orgId,
  );
}

export function messagesForChannel(state: State, channelId: string) {
  return Object.values(state.message)
    .filter((msg) => msg.chatId === channelId && msg.threadId === null)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function threadMessagesForRoot(state: State, threadId: string) {
  return Object.values(state.message)
    .filter((msg) => msg.threadId === threadId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function unreadCountForChannel(state: State, chatId: string): number {
  const rs = state.readState[chatId];
  return rs ? rs.unreadCount : 0;
}

export function typingUsersForChannel(
  state: State,
  chatId: string,
  selfUserId: string,
) {
  const now = Date.now();
  const prefix = `${chatId}:`;
  return Object.values(state.typing).filter(
    (t) =>
      t.id.startsWith(prefix) &&
      t.userId !== selfUserId &&
      t.expiresAt > now,
  );
}

export function presenceForUser(
  state: State,
  userId: string,
): "online" | "away" | "offline" {
  const p = state.presence[userId];
  return p ? p.status : "offline";
}
