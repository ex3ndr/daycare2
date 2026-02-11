export type Id = string;
export type UnixMs = number;

export type ApiError = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

export type ApiResponse<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: ApiError;
    };

export type Account = {
  id: Id;
  email: string;
  createdAt: UnixMs;
  updatedAt: UnixMs;
};

export type Session = {
  id: Id;
  expiresAt: UnixMs;
};

export type Organization = {
  id: Id;
  slug: string;
  name: string;
  avatarUrl: string | null;
  createdAt: UnixMs;
  updatedAt: UnixMs;
};

export type User = {
  id: Id;
  organizationId: Id;
  kind: "human" | "ai";
  username: string;
  firstName: string;
  lastName: string | null;
  avatarUrl: string | null;
  bio?: string | null;
  timezone?: string | null;
  systemPrompt?: string | null;
  createdAt: UnixMs;
  updatedAt: UnixMs;
};

export type Channel = {
  id: Id;
  organizationId: Id;
  name: string;
  topic: string | null;
  visibility: "public" | "private";
  createdAt: UnixMs;
  updatedAt: UnixMs;
};

export type ChannelMember = {
  chatId: Id;
  userId: Id;
  role: "owner" | "member";
  joinedAt: UnixMs;
  leftAt: UnixMs | null;
};

export type MessageAttachment = {
  id: Id;
  kind: string;
  url: string;
  mimeType: string | null;
  fileName: string | null;
  sizeBytes: number | null;
  sortOrder: number;
};

export type MessageReaction = {
  id: Id;
  userId: Id;
  shortcode: string;
  createdAt: UnixMs;
};

export type Message = {
  id: Id;
  chatId: Id;
  senderUserId: Id;
  threadId: Id | null;
  text: string;
  createdAt: UnixMs;
  editedAt: UnixMs | null;
  deletedAt: UnixMs | null;
  threadReplyCount: number;
  threadLastReplyAt: UnixMs | null;
  sender: Pick<User, "id" | "kind" | "username" | "firstName" | "lastName" | "avatarUrl">;
  attachments: MessageAttachment[];
  reactions: MessageReaction[];
};

export type MessageListResponse = {
  messages: Message[];
};

export type TypingState = {
  userId: Id;
  username: string;
  firstName: string;
  expiresAt: UnixMs;
};

export type ReadState = {
  chatId: Id;
  lastReadAt: UnixMs | null;
  unreadCount: number;
};

export type UpdateEnvelope = {
  id: Id;
  userId: Id;
  seqno: number;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: UnixMs;
};

export type Direct = {
  channel: Channel & { kind: "direct" };
  otherUser: Pick<User, "id" | "kind" | "username" | "firstName" | "lastName" | "avatarUrl">;
};

export type UpdatesDiffResult = {
  updates: UpdateEnvelope[];
  headOffset: number;
  resetRequired: boolean;
};

export type MessageSearchResult = {
  id: Id;
  chatId: Id;
  senderUserId: Id;
  text: string;
  highlight: string;
  createdAt: UnixMs;
};

export type ChannelSearchResult = {
  id: Id;
  organizationId: Id;
  name: string | null;
  topic: string | null;
  visibility: "public" | "private";
  createdAt: UnixMs;
  updatedAt: UnixMs;
};

export type PresenceStatus = "online" | "away" | "offline";

export type Presence = {
  userId: Id;
  status: PresenceStatus;
  lastSeenAt: UnixMs;
};
