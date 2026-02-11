export type Id = string;
export type UnixMs = number;

export type UserKind = "human" | "ai";
export type ChatKind = "channel" | "direct";

export type Session = {
  id: Id;
  accountId: Id;
  tokenHash: string;
  createdAt: UnixMs;
  expiresAt: UnixMs;
  revokedAt: UnixMs | null;
  lastSeenAt: UnixMs | null;
};

export type Organization = {
  id: Id;
  slug: string;
  name: string;
  public: boolean;
  avatarUrl: string | null;
  createdAt: UnixMs;
  updatedAt: UnixMs;
};

export type User = {
  id: Id;
  organizationId: Id;
  accountId: Id | null;
  kind: UserKind;
  username: string;
  firstName: string;
  lastName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  timezone: string | null;
  systemPrompt: string | null;
  createdAt: UnixMs;
  updatedAt: UnixMs;
};

export type Channel = {
  id: Id;
  organizationId: Id;
  name: string;
  slug: string;
  topic: string | null;
  createdByUserId: Id | null;
  createdAt: UnixMs;
  updatedAt: UnixMs;
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
};
