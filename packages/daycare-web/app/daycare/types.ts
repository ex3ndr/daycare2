export type Id = string;
export type UnixMs = number;
export type Cursor = string;

export type UserKind = "human" | "ai";
export type OrganizationRole = "owner" | "admin" | "member";
export type ChannelVisibility = "public" | "private";
export type ChannelMemberRole = "owner" | "member";
export type AttachmentKind = "image" | "document" | "audio";

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export type ApiError = {
  code: ApiErrorCode;
  message: string;
  details?: Record<string, unknown>;
};

export type ApiSuccess<T> = {
  ok: true;
  data: T;
};

export type ApiFailure = {
  ok: false;
  error: ApiError;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export type Account = {
  id: Id;
  email: string;
  createdAt: UnixMs;
  updatedAt: UnixMs;
};

export type Session = {
  token: string;
  accountId: Id;
  createdAt: UnixMs;
  expiresAt: UnixMs | null;
};

export type Organization = {
  id: Id;
  slug: string;
  name: string;
  avatarUrl: string | null;
  createdBy: Id;
  createdAt: UnixMs;
  updatedAt: UnixMs;
};

export type OrganizationMembership = {
  organizationId: Id;
  userId: Id;
  role: OrganizationRole;
  joinedAt: UnixMs;
};

export type User = {
  id: Id;
  organizationId: Id;
  accountId: Id;
  kind: UserKind;
  username: string;
  firstName: string;
  lastName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  timezone: string;
  systemPrompt: string | null;
  createdAt: UnixMs;
  updatedAt: UnixMs;
};

export type Channel = {
  id: Id;
  organizationId: Id;
  name: string;
  slug: string;
  visibility: ChannelVisibility;
  topic: string | null;
  createdBy: Id;
  createdAt: UnixMs;
  updatedAt: UnixMs;
};

export type ChannelMember = {
  channelId: Id;
  userId: Id;
  role: ChannelMemberRole;
  joinedAt: UnixMs;
};

export type FileAttachment = {
  id: Id;
  organizationId: Id;
  kind: AttachmentKind;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  hashSha256: string;
  storageKey: string;
  createdBy: Id;
  createdAt: UnixMs;
};

export type MessageReaction = {
  shortcode: string;
  userIds: Id[];
  count: number;
  updatedAt: UnixMs;
};

export type Message = {
  id: Id;
  organizationId: Id;
  channelId: Id;
  authorId: Id;
  text: string;
  mentionUserIds: Id[];
  threadRootMessageId: Id | null;
  threadReplyCount: number;
  threadLastReplyAt: UnixMs | null;
  attachments: FileAttachment[];
  reactions: MessageReaction[];
  createdAt: UnixMs;
  updatedAt: UnixMs;
  deletedAt: UnixMs | null;
  clientMessageId?: string;
};

export type MessageView = {
  message: Message;
  author: Pick<User, "id" | "kind" | "username" | "firstName" | "lastName" | "avatarUrl">;
};

export type TypingIndicator = {
  organizationId: Id;
  channelId: Id;
  userId: Id;
  threadRootMessageId: Id | null;
  startedAt: UnixMs;
  expiresAt: UnixMs;
  updatedAt: UnixMs;
};

export type ChannelReadState = {
  organizationId: Id;
  channelId: Id;
  userId: Id;
  lastReadAtMs: UnixMs;
  lastReadMessageId: Id | null;
  unreadCount: number;
  updatedAt: UnixMs;
};

export type MessageListPage = {
  items: MessageView[];
  page: {
    limit: number;
    nextCursor: Cursor | null;
    prevCursor: Cursor | null;
    hasMoreOlder: boolean;
    hasMoreNewer: boolean;
  };
};

export type ChannelListPage = {
  items: Channel[];
  nextCursor: Cursor | null;
};

export type UpdatesDiffItem = {
  seqno: number;
  event: DaycareSseEvent["event"];
  data: unknown;
  at: UnixMs;
};

export type SseEventUserUpdated = {
  event: "user.updated";
  data: { user: User };
};

export type SseEventOrganizationUpdated = {
  event: "organization.updated";
  data: { organization: Organization };
};

export type SseEventOrganizationJoined = {
  event: "organization.joined";
  data: {
    organization: Organization;
    user: User;
    membership: OrganizationMembership;
  };
};

export type SseEventOrganizationLeft = {
  event: "organization.left";
  data: {
    organizationId: Id;
    userId: Id;
    leftAt: UnixMs;
  };
};

export type SseEventMemberJoined = {
  event: "member.joined";
  data: {
    channelId: Id;
    userId: Id;
    joinedAt: UnixMs;
  };
};

export type SseEventMemberLeft = {
  event: "member.left";
  data: {
    channelId: Id;
    userId: Id;
    leftAt: UnixMs;
  };
};

export type SseEventChannelCreated = {
  event: "channel.created";
  data: { channel: Channel };
};

export type SseEventChannelUpdated = {
  event: "channel.updated";
  data: { channel: Channel };
};

export type SseEventMessageCreated = {
  event: "message.created";
  data: { message: MessageView };
};

export type SseEventMessageUpdated = {
  event: "message.updated";
  data: { message: MessageView };
};

export type SseEventMessageDeleted = {
  event: "message.deleted";
  data: {
    messageId: Id;
    channelId: Id;
    deletedAt: UnixMs;
  };
};

export type SseEventThreadUpdated = {
  event: "thread.updated";
  data: {
    channelId: Id;
    threadRootMessageId: Id;
    threadReplyCount: number;
    threadLastReplyAt: UnixMs | null;
  };
};

export type SseEventReactionUpdated = {
  event: "reaction.updated";
  data: {
    channelId: Id;
    messageId: Id;
    reactions: MessageReaction[];
  };
};

export type SseEventTypingUpdated = {
  event: "typing.updated";
  data: {
    channelId: Id;
    threadRootMessageId: Id | null;
    items: TypingIndicator[];
  };
};

export type SseEventReadUpdated = {
  event: "read.updated";
  data: {
    channelId: Id;
    userId: Id;
    readState: ChannelReadState;
  };
};

export type DaycareSseEvent =
  | SseEventUserUpdated
  | SseEventOrganizationUpdated
  | SseEventOrganizationJoined
  | SseEventOrganizationLeft
  | SseEventMemberJoined
  | SseEventMemberLeft
  | SseEventChannelCreated
  | SseEventChannelUpdated
  | SseEventMessageCreated
  | SseEventMessageUpdated
  | SseEventMessageDeleted
  | SseEventThreadUpdated
  | SseEventReactionUpdated
  | SseEventTypingUpdated
  | SseEventReadUpdated;

export type AuthEmailRequestOtpRequest = {
  email: string;
};

export type AuthEmailRequestOtpResponse = {
  sent: true;
  retryAfterMs: number;
};

export type AuthEmailVerifyOtpRequest = {
  email: string;
  otp: string;
};

export type AuthEmailVerifyOtpResponse = {
  session: Session;
  account: Account;
  onboarding: {
    needsOrganization: boolean;
    needsProfile: boolean;
  };
};

export type AuthLogoutResponse = {
  loggedOut: true;
};

export type MeGetResponse = {
  session: Session;
  account: Account;
};

export type OrganizationAvailableResponse = {
  items: Array<{
    organization: Organization;
    membership: OrganizationMembership | null;
    user: User | null;
  }>;
  nextCursor: Cursor | null;
};

export type OrganizationCreateRequest = {
  name: string;
  slug?: string;
};

export type OrganizationCreateResponse = {
  organization: Organization;
  user: User;
  membership: OrganizationMembership;
};

export type OrganizationJoinRequest = {
  firstName?: string;
  lastName?: string;
  username?: string;
};

export type OrganizationJoinResponse = {
  organization: Organization;
  user: User;
  membership: OrganizationMembership;
  createdProfile: boolean;
};

export type OrganizationMemberListResponse = {
  items: Array<{
    membership: OrganizationMembership;
    user: Pick<User, "id" | "kind" | "username" | "firstName" | "lastName" | "avatarUrl">;
  }>;
};

export type ChannelListQuery = {
  search?: string;
  visibility?: ChannelVisibility;
  limit?: number;
  cursor?: Cursor;
};

export type ChannelCreateRequest = {
  name: string;
  slug?: string;
  visibility?: ChannelVisibility;
  topic?: string;
};

export type ChannelCreateResponse = {
  channel: Channel;
};

export type ChannelJoinResponse = {
  member: ChannelMember;
};

export type ChannelMemberListResponse = {
  items: Array<{
    member: ChannelMember;
    user: Pick<User, "id" | "kind" | "username" | "firstName" | "lastName" | "avatarUrl">;
  }>;
};

export type MessageListQuery = {
  limit?: number;
  before?: Cursor;
  after?: Cursor;
  around?: Cursor;
  threadRootMessageId?: Id;
};

export type MessageSendRequest = {
  channelId: Id;
  text: string;
  threadRootMessageId?: Id;
  attachmentIds?: Id[];
  clientMessageId?: string;
};

export type MessageSendResponse = {
  message: MessageView;
};

export type MessageEditRequest = {
  text: string;
};

export type MessageEditResponse = {
  message: MessageView;
};

export type MessageDeleteResponse = {
  messageId: Id;
  channelId: Id;
  deletedAt: UnixMs;
};

export type MessageReactionAddRequest = {
  shortcode: string;
};

export type MessageReactionAddResponse = {
  messageId: Id;
  reactions: MessageReaction[];
};

export type TypingUpsertRequest = {
  isTyping: boolean;
  threadRootMessageId?: Id;
  ttlMs?: number;
};

export type TypingUpsertResponse = {
  typing: TypingIndicator;
};

export type TypingListResponse = {
  items: TypingIndicator[];
};

export type ReadStateSetRequest = {
  lastReadMessageId?: Id;
  lastReadAtMs: UnixMs;
};

export type ReadStateSetResponse = {
  readState: ChannelReadState;
};

export type ReadStateGetResponse = {
  readState: ChannelReadState;
};

export type UpdatesDiffRequest = {
  offset: number;
};

export type UpdatesDiffResponse = {
  headOffset: number;
  resetRequired: boolean;
  updates: UpdatesDiffItem[];
};

export type StreamListener = (update: UpdatesDiffItem) => void;
