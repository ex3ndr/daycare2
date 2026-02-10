import type {
  Account,
  AuthEmailRequestOtpRequest,
  AuthEmailRequestOtpResponse,
  AuthEmailVerifyOtpRequest,
  AuthEmailVerifyOtpResponse,
  AuthLogoutResponse,
  Channel,
  ChannelCreateRequest,
  ChannelCreateResponse,
  ChannelJoinResponse,
  ChannelListPage,
  ChannelListQuery,
  ChannelMember,
  ChannelMemberListResponse,
  ChannelReadState,
  Cursor,
  DaycareSseEvent,
  FileAttachment,
  Id,
  MeGetResponse,
  Message,
  MessageDeleteResponse,
  MessageEditRequest,
  MessageEditResponse,
  MessageListPage,
  MessageListQuery,
  MessageReaction,
  MessageReactionAddRequest,
  MessageReactionAddResponse,
  MessageSendRequest,
  MessageSendResponse,
  MessageView,
  Organization,
  OrganizationAvailableResponse,
  OrganizationCreateRequest,
  OrganizationCreateResponse,
  OrganizationJoinRequest,
  OrganizationJoinResponse,
  OrganizationMemberListResponse,
  OrganizationMembership,
  ReadStateGetResponse,
  ReadStateSetRequest,
  ReadStateSetResponse,
  Session,
  StreamListener,
  TypingIndicator,
  TypingListResponse,
  TypingUpsertRequest,
  TypingUpsertResponse,
  UnixMs,
  UpdatesDiffItem,
  UpdatesDiffRequest,
  UpdatesDiffResponse,
  User
} from "../types";

const OTP_CODE = "111111";
const UPDATE_RETENTION = 5000;
const DEFAULT_PAGE_SIZE = 50;

const BOT_LINES = [
  "SSE stream is stable and replay-capable.",
  "Unread count is computed from read state and message timeline.",
  "Optimistic updates keep the composer feeling instant.",
  "Thread roots are updated whenever a reply lands.",
  "Reliable sync starts with diff before stream."
];

type SessionState = {
  session: Session;
  accountId: Id;
};

type StreamSubscription = {
  close: () => void;
  headOffset: number;
};

type MockErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT";

type MockServerError = Error & {
  code: MockErrorCode;
  details?: Record<string, unknown>;
};

type OrgState = {
  organization: Organization;
  usersById: Map<Id, User>;
  userIdByAccountId: Map<Id, Id>;
  membershipsByAccountId: Map<Id, OrganizationMembership>;
  channelsById: Map<Id, Channel>;
  channelMembersByChannelId: Map<Id, Map<Id, ChannelMember>>;
  messagesByChannelId: Map<Id, Message[]>;
  filesById: Map<Id, FileAttachment>;
  typingByChannelThreadKey: Map<string, Map<Id, TypingIndicator>>;
  readStatesByChannelId: Map<Id, Map<Id, ChannelReadState>>;
  updates: UpdatesDiffItem[];
  headOffset: number;
  subscribers: Set<StreamListener>;
  dropNextStreamEvent: boolean;
};

export type MockServer = {
  authEmailRequestOtp: (input: AuthEmailRequestOtpRequest) => Promise<AuthEmailRequestOtpResponse>;
  authEmailVerifyOtp: (input: AuthEmailVerifyOtpRequest) => Promise<AuthEmailVerifyOtpResponse>;
  authLogout: (token: string) => Promise<AuthLogoutResponse>;
  meGet: (token: string) => Promise<MeGetResponse>;
  organizationAvailableList: (token: string) => Promise<OrganizationAvailableResponse>;
  organizationCreate: (token: string, input: OrganizationCreateRequest) => Promise<OrganizationCreateResponse>;
  organizationJoin: (token: string, orgId: Id, input: OrganizationJoinRequest) => Promise<OrganizationJoinResponse>;
  organizationGet: (token: string, orgId: Id) => Promise<{ organization: Organization }>;
  organizationMembers: (token: string, orgId: Id) => Promise<OrganizationMemberListResponse>;
  channelList: (token: string, orgId: Id, query?: ChannelListQuery) => Promise<ChannelListPage>;
  channelCreate: (token: string, orgId: Id, input: ChannelCreateRequest) => Promise<ChannelCreateResponse>;
  channelJoin: (token: string, orgId: Id, channelId: Id) => Promise<ChannelJoinResponse>;
  channelLeave: (token: string, orgId: Id, channelId: Id) => Promise<{ channelId: Id; userId: Id; leftAt: UnixMs }>;
  channelMembers: (token: string, orgId: Id, channelId: Id) => Promise<ChannelMemberListResponse>;
  messageList: (token: string, orgId: Id, channelId: Id, query?: MessageListQuery) => Promise<MessageListPage>;
  messageSend: (token: string, orgId: Id, input: MessageSendRequest) => Promise<MessageSendResponse>;
  messageEdit: (token: string, orgId: Id, messageId: Id, input: MessageEditRequest) => Promise<MessageEditResponse>;
  messageDelete: (token: string, orgId: Id, messageId: Id) => Promise<MessageDeleteResponse>;
  messageReactionAdd: (
    token: string,
    orgId: Id,
    messageId: Id,
    input: MessageReactionAddRequest
  ) => Promise<MessageReactionAddResponse>;
  messageReactionRemove: (
    token: string,
    orgId: Id,
    messageId: Id,
    input: MessageReactionAddRequest
  ) => Promise<MessageReactionAddResponse>;
  fileUploadInit: (
    token: string,
    orgId: Id,
    input: { filename: string; mimeType: string; sizeBytes: number; hashSha256: string }
  ) => Promise<{
    attachmentId: Id;
    uploadUrl: string;
    uploadHeaders: Record<string, string>;
    expiresAt: UnixMs;
  }>;
  typingUpsert: (
    token: string,
    orgId: Id,
    channelId: Id,
    input: TypingUpsertRequest
  ) => Promise<TypingUpsertResponse>;
  typingList: (token: string, orgId: Id, channelId: Id) => Promise<TypingListResponse>;
  readStateSet: (
    token: string,
    orgId: Id,
    channelId: Id,
    input: ReadStateSetRequest
  ) => Promise<ReadStateSetResponse>;
  readStateGet: (token: string, orgId: Id, channelId: Id) => Promise<ReadStateGetResponse>;
  updatesDiff: (token: string, orgId: Id, input: UpdatesDiffRequest) => Promise<UpdatesDiffResponse>;
  updatesStreamSubscribe: (token: string, orgId: Id, listener: StreamListener) => Promise<StreamSubscription>;
  updatesHoleSimulate: (orgId: Id) => Promise<{ armed: true }>;
};

export function mockServerCreate(): MockServer {
  const accountsById = new Map<Id, Account>();
  const accountIdByEmail = new Map<string, Id>();
  const sessionsByToken = new Map<string, SessionState>();
  const pendingOtpByEmail = new Map<string, string>();
  const organizationsById = new Map<Id, OrgState>();
  const organizationOrder: Id[] = [];
  const timers = {
    typingCleanup: 0,
    bot: 0
  };

  let idCounter = 0;
  let botLineIndex = 0;

  const nowMs = (): UnixMs => Date.now();

  const idCreate = (prefix: string): Id => {
    idCounter += 1;
    return `${prefix}_${idCounter.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  };

  const slugCreate = (raw: string): string => {
    return raw
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 48);
  };

  const ensureError = (code: MockErrorCode, message: string, details?: Record<string, unknown>): never => {
    const error = new Error(message) as MockServerError;
    error.code = code;
    error.details = details;
    throw error;
  };

  const valueRequire = <T>(
    value: T | undefined,
    code: MockErrorCode,
    message: string,
    details?: Record<string, unknown>
  ): T => {
    if (value === undefined) {
      ensureError(code, message, details);
    }
    return value as T;
  };

  const withLatency = async <T>(run: () => T): Promise<T> => {
    const latencyMs = 20 + Math.floor(Math.random() * 90);
    await new Promise((resolve) => setTimeout(resolve, latencyMs));
    return run();
  };

  const accountByTokenGet = (token: string): Account => {
    const session = valueRequire(sessionsByToken.get(token), "UNAUTHORIZED", "Invalid session token");
    return valueRequire(accountsById.get(session.accountId), "UNAUTHORIZED", "Account not found");
  };

  const sessionByTokenGet = (token: string): Session => {
    return valueRequire(sessionsByToken.get(token), "UNAUTHORIZED", "Invalid session token").session;
  };

  const orgByIdGet = (orgId: Id): OrgState => {
    return valueRequire(organizationsById.get(orgId), "NOT_FOUND", "Organization not found");
  };

  const orgMemberGet = (token: string, orgId: Id): { account: Account; orgState: OrgState; user: User } => {
    const account = accountByTokenGet(token);
    const orgState = orgByIdGet(orgId);
    const membership = valueRequire(
      orgState.membershipsByAccountId.get(account.id),
      "FORBIDDEN",
      "Account is not a member of this organization"
    );
    const user = valueRequire(orgState.usersById.get(membership.userId), "NOT_FOUND", "User profile not found");
    return { account, orgState, user };
  };

  const channelMemberRequire = (orgState: OrgState, channelId: Id, userId: Id): Channel => {
    const channel = valueRequire(orgState.channelsById.get(channelId), "NOT_FOUND", "Channel not found");
    const memberMap = orgState.channelMembersByChannelId.get(channel.id);
    if (!memberMap || !memberMap.has(userId)) {
      ensureError("FORBIDDEN", "User is not a channel member");
    }
    return channel;
  };

  const userPreviewCreate = (user: User): MessageView["author"] => {
    return {
      id: user.id,
      kind: user.kind,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl
    };
  };

  const messageViewCreate = (orgState: OrgState, message: Message): MessageView => {
    const author = orgState.usersById.get(message.authorId);
    if (!author) {
      ensureError("NOT_FOUND", "Message author not found");
    }
    return { message: { ...message }, author: userPreviewCreate(author as User) };
  };

  const unreadCountCompute = (orgState: OrgState, channelId: Id, userId: Id, lastReadAtMs: UnixMs): number => {
    const messages = orgState.messagesByChannelId.get(channelId) ?? [];
    return messages.filter((message) => {
      if (message.deletedAt) {
        return false;
      }
      if (message.authorId === userId) {
        return false;
      }
      return message.createdAt > lastReadAtMs;
    }).length;
  };

  const readStateGetOrCreate = (orgState: OrgState, channelId: Id, userId: Id): ChannelReadState => {
    let byUser = orgState.readStatesByChannelId.get(channelId);
    if (!byUser) {
      byUser = new Map<Id, ChannelReadState>();
      orgState.readStatesByChannelId.set(channelId, byUser);
    }
    let read = byUser.get(userId);
    if (!read) {
      const createdAt = nowMs();
      read = {
        organizationId: orgState.organization.id,
        channelId,
        userId,
        lastReadAtMs: 0,
        lastReadMessageId: null,
        unreadCount: unreadCountCompute(orgState, channelId, userId, 0),
        updatedAt: createdAt
      };
      byUser.set(userId, read);
    }
    read.unreadCount = unreadCountCompute(orgState, channelId, userId, read.lastReadAtMs);
    return read;
  };

  const updateEmit = <TEvent extends DaycareSseEvent["event"]>(
    orgState: OrgState,
    event: TEvent,
    data: Extract<DaycareSseEvent, { event: TEvent }>["data"]
  ): UpdatesDiffItem => {
    const update: UpdatesDiffItem = {
      seqno: orgState.headOffset + 1,
      event,
      data,
      at: nowMs()
    };
    orgState.headOffset = update.seqno;
    orgState.updates.push(update);
    if (orgState.updates.length > UPDATE_RETENTION) {
      orgState.updates.splice(0, orgState.updates.length - UPDATE_RETENTION);
    }
    if (orgState.dropNextStreamEvent) {
      orgState.dropNextStreamEvent = false;
      return update;
    }
    for (const listener of orgState.subscribers) {
      setTimeout(() => listener(update), 0);
    }
    return update;
  };

  const typingKeyCreate = (channelId: Id, threadRootMessageId: Id | null): string => {
    return `${channelId}:${threadRootMessageId ?? "root"}`;
  };

  const typingBroadcast = (orgState: OrgState, channelId: Id, threadRootMessageId: Id | null): void => {
    const key = typingKeyCreate(channelId, threadRootMessageId);
    const bucket = orgState.typingByChannelThreadKey.get(key);
    const items = Array.from(bucket?.values() ?? []).filter((item) => item.expiresAt > nowMs());
    updateEmit(orgState, "typing.updated", { channelId, threadRootMessageId, items });
  };

  const mentionsParse = (orgState: OrgState, text: string): Id[] => {
    const matches = new Set<string>();
    for (const match of text.matchAll(/@([a-z0-9_]{3,32})/g)) {
      const username = match[1];
      if (username) {
        matches.add(username);
      }
    }
    if (matches.size === 0) {
      return [];
    }
    const mentionedIds: Id[] = [];
    for (const user of orgState.usersById.values()) {
      if (matches.has(user.username)) {
        mentionedIds.push(user.id);
      }
    }
    return mentionedIds;
  };

  const reactionRequire = (shortcode: string): void => {
    if (!/^:[a-z0-9_+-]+:$/.test(shortcode)) {
      ensureError("VALIDATION_ERROR", "Invalid reaction shortcode");
    }
  };

  const orgAddDefaultChannel = (orgState: OrgState, creatorUserId: Id): Channel => {
    const createdAt = nowMs();
    const channel: Channel = {
      id: idCreate("channel"),
      organizationId: orgState.organization.id,
      name: "general",
      slug: "general",
      visibility: "public",
      topic: "Company-wide updates and rollout coordination.",
      createdBy: creatorUserId,
      createdAt,
      updatedAt: createdAt
    };
    orgState.channelsById.set(channel.id, channel);
    orgState.channelMembersByChannelId.set(channel.id, new Map<Id, ChannelMember>());
    orgState.messagesByChannelId.set(channel.id, []);
    return channel;
  };

  const orgAddAiUser = (orgState: OrgState): User => {
    const createdAt = nowMs();
    const accountId = idCreate("acct");
    const aiUser: User = {
      id: idCreate("user"),
      organizationId: orgState.organization.id,
      accountId,
      kind: "ai",
      username: "tactical_bot",
      firstName: "Tactical",
      lastName: "Bot",
      avatarUrl: null,
      bio: "Operational assistant from the happy playbook.",
      timezone: "UTC",
      systemPrompt: "Concise execution partner.",
      createdAt,
      updatedAt: createdAt
    };
    orgState.usersById.set(aiUser.id, aiUser);
    return aiUser;
  };

  const channelMemberAdd = (
    orgState: OrgState,
    channelId: Id,
    userId: Id,
    role: ChannelMember["role"] = "member"
  ): ChannelMember => {
    let byUser = orgState.channelMembersByChannelId.get(channelId);
    if (!byUser) {
      byUser = new Map<Id, ChannelMember>();
      orgState.channelMembersByChannelId.set(channelId, byUser);
    }
    const member: ChannelMember = {
      channelId,
      userId,
      role,
      joinedAt: nowMs()
    };
    byUser.set(userId, member);
    return member;
  };

  const messageFind = (
    orgState: OrgState,
    messageId: Id
  ): { message: Message; messages: Message[]; channelId: Id; index: number } => {
    for (const [channelId, messages] of orgState.messagesByChannelId) {
      const index = messages.findIndex((item) => item.id === messageId);
      if (index >= 0) {
        const message = messages[index];
        if (!message) {
          ensureError("NOT_FOUND", "Message not found");
        }
        return { message, messages, channelId, index };
      }
    }
    ensureError("NOT_FOUND", "Message not found");
    throw new Error("Unreachable");
  };

  const accountCreate = (email: string): Account => {
    const createdAt = nowMs();
    const account: Account = {
      id: idCreate("acct"),
      email,
      createdAt,
      updatedAt: createdAt
    };
    accountsById.set(account.id, account);
    accountIdByEmail.set(email, account.id);
    return account;
  };

  const orgCreateInternal = (name: string, slug: string, createdByAccountId: Id): OrgState => {
    const createdAt = nowMs();
    const organization: Organization = {
      id: idCreate("org"),
      slug,
      name,
      avatarUrl: null,
      createdBy: createdByAccountId,
      createdAt,
      updatedAt: createdAt
    };
    const orgState: OrgState = {
      organization,
      usersById: new Map<Id, User>(),
      userIdByAccountId: new Map<Id, Id>(),
      membershipsByAccountId: new Map<Id, OrganizationMembership>(),
      channelsById: new Map<Id, Channel>(),
      channelMembersByChannelId: new Map<Id, Map<Id, ChannelMember>>(),
      messagesByChannelId: new Map<Id, Message[]>(),
      filesById: new Map<Id, FileAttachment>(),
      typingByChannelThreadKey: new Map<string, Map<Id, TypingIndicator>>(),
      readStatesByChannelId: new Map<Id, Map<Id, ChannelReadState>>(),
      updates: [],
      headOffset: 0,
      subscribers: new Set<StreamListener>(),
      dropNextStreamEvent: false
    };
    organizationsById.set(organization.id, orgState);
    organizationOrder.push(organization.id);
    return orgState;
  };

  const userCreateInternal = (
    orgState: OrgState,
    account: Account,
    profile: { firstName: string; lastName: string | null; username: string; role: OrganizationMembership["role"] }
  ): { user: User; membership: OrganizationMembership } => {
    const usernameTaken = Array.from(orgState.usersById.values()).some((item) => item.username === profile.username);
    if (usernameTaken) {
      ensureError("CONFLICT", "Username is already taken", { field: "username" });
    }
    const createdAt = nowMs();
    const user: User = {
      id: idCreate("user"),
      organizationId: orgState.organization.id,
      accountId: account.id,
      kind: "human",
      username: profile.username,
      firstName: profile.firstName,
      lastName: profile.lastName,
      avatarUrl: null,
      bio: null,
      timezone: "UTC",
      systemPrompt: null,
      createdAt,
      updatedAt: createdAt
    };
    const membership: OrganizationMembership = {
      organizationId: orgState.organization.id,
      userId: user.id,
      role: profile.role,
      joinedAt: createdAt
    };
    orgState.usersById.set(user.id, user);
    orgState.userIdByAccountId.set(account.id, user.id);
    orgState.membershipsByAccountId.set(account.id, membership);
    return { user, membership };
  };

  const authSeed = (): void => {
    const demoAccount = accountCreate("demo@daycare.dev");
    const orgState = orgCreateInternal("Tactical Happy Studio", "tactical-happy", demoAccount.id);
    const owner = userCreateInternal(orgState, demoAccount, {
      firstName: "Tina",
      lastName: "Cole",
      username: "tina",
      role: "owner"
    });
    const aiUser = orgAddAiUser(orgState);
    const general = orgAddDefaultChannel(orgState, owner.user.id);
    channelMemberAdd(orgState, general.id, owner.user.id, "owner");
    channelMemberAdd(orgState, general.id, aiUser.id);

    const launchesCreatedAt = nowMs();
    const launches: Channel = {
      id: idCreate("channel"),
      organizationId: orgState.organization.id,
      name: "launches",
      slug: "launches",
      visibility: "public",
      topic: "Go-to-market workstream and release sequencing.",
      createdBy: owner.user.id,
      createdAt: launchesCreatedAt,
      updatedAt: launchesCreatedAt
    };
    orgState.channelsById.set(launches.id, launches);
    orgState.channelMembersByChannelId.set(launches.id, new Map<Id, ChannelMember>());
    orgState.messagesByChannelId.set(launches.id, []);
    channelMemberAdd(orgState, launches.id, owner.user.id, "owner");
    channelMemberAdd(orgState, launches.id, aiUser.id);

    const welcomeA: Message = {
      id: idCreate("msg"),
      organizationId: orgState.organization.id,
      channelId: general.id,
      authorId: aiUser.id,
      text: "Welcome to Daycare. Use OTP `111111` and ship in tight loops.",
      mentionUserIds: [],
      threadRootMessageId: null,
      threadReplyCount: 0,
      threadLastReplyAt: null,
      attachments: [],
      reactions: [],
      createdAt: nowMs() - 1000 * 60 * 4,
      updatedAt: nowMs() - 1000 * 60 * 4,
      deletedAt: null
    };
    const welcomeB: Message = {
      id: idCreate("msg"),
      organizationId: orgState.organization.id,
      channelId: general.id,
      authorId: owner.user.id,
      text: "Start with org setup, then channels, then stream sync checks.",
      mentionUserIds: [],
      threadRootMessageId: null,
      threadReplyCount: 0,
      threadLastReplyAt: null,
      attachments: [],
      reactions: [],
      createdAt: nowMs() - 1000 * 60 * 2,
      updatedAt: nowMs() - 1000 * 60 * 2,
      deletedAt: null
    };
    orgState.messagesByChannelId.get(general.id)?.push(welcomeA, welcomeB);
    const defaultRead = readStateGetOrCreate(orgState, general.id, owner.user.id);
    defaultRead.lastReadAtMs = welcomeB.createdAt;
    defaultRead.lastReadMessageId = welcomeB.id;
    defaultRead.unreadCount = 0;
    defaultRead.updatedAt = nowMs();

    const openOrg = orgCreateInternal("Open Collaboration Space", "open-space", demoAccount.id);
    orgAddAiUser(openOrg);
    const openGeneral = orgAddDefaultChannel(openOrg, owner.user.id);
    openOrg.messagesByChannelId.get(openGeneral.id)?.push({
      id: idCreate("msg"),
      organizationId: openOrg.organization.id,
      channelId: openGeneral.id,
      authorId: Array.from(openOrg.usersById.values())[0]?.id ?? owner.user.id,
      text: "Anyone can join this org from the picker.",
      mentionUserIds: [],
      threadRootMessageId: null,
      threadReplyCount: 0,
      threadLastReplyAt: null,
      attachments: [],
      reactions: [],
      createdAt: nowMs() - 1000 * 40,
      updatedAt: nowMs() - 1000 * 40,
      deletedAt: null
    });
  };

  const typingCleanupRun = (): void => {
    for (const orgState of organizationsById.values()) {
      for (const [key, bucket] of orgState.typingByChannelThreadKey) {
        const [channelId, root] = key.split(":");
        const before = bucket.size;
        for (const [userId, typing] of bucket) {
          if (typing.expiresAt <= nowMs()) {
            bucket.delete(userId);
          }
        }
        if (bucket.size !== before) {
          typingBroadcast(orgState, channelId, root === "root" ? null : root);
        }
      }
    }
  };

  const botPulseRun = (): void => {
    for (const orgState of organizationsById.values()) {
      if (orgState.channelsById.size === 0) {
        continue;
      }
      const aiUser = Array.from(orgState.usersById.values()).find((user) => user.kind === "ai");
      if (!aiUser) {
        continue;
      }
      const targetChannel = Array.from(orgState.channelsById.values()).find((channel) => {
        const members = orgState.channelMembersByChannelId.get(channel.id);
        return members?.has(aiUser.id);
      });
      if (!targetChannel) {
        continue;
      }
      const createdAt = nowMs();
      const line = BOT_LINES[botLineIndex % BOT_LINES.length] ?? BOT_LINES[0];
      botLineIndex += 1;
      const message: Message = {
        id: idCreate("msg"),
        organizationId: orgState.organization.id,
        channelId: targetChannel.id,
        authorId: aiUser.id,
        text: line,
        mentionUserIds: [],
        threadRootMessageId: null,
        threadReplyCount: 0,
        threadLastReplyAt: null,
        attachments: [],
        reactions: [],
        createdAt,
        updatedAt: createdAt,
        deletedAt: null
      };
      const messages = orgState.messagesByChannelId.get(targetChannel.id);
      if (!messages) {
        continue;
      }
      messages.push(message);
      const channel = orgState.channelsById.get(targetChannel.id);
      if (channel) {
        channel.updatedAt = createdAt;
      }
      updateEmit(orgState, "message.created", { message: messageViewCreate(orgState, message) });
    }
  };

  authSeed();
  timers.typingCleanup = window.setInterval(typingCleanupRun, 1000);
  timers.bot = window.setInterval(botPulseRun, 12000);

  return {
    authEmailRequestOtp: async (input) =>
      withLatency(() => {
        const email = input.email.trim().toLowerCase();
        if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
          ensureError("VALIDATION_ERROR", "Invalid email address", { field: "email" });
        }
        pendingOtpByEmail.set(email, OTP_CODE);
        return {
          sent: true,
          retryAfterMs: 30_000
        };
      }),

    authEmailVerifyOtp: async (input) =>
      withLatency(() => {
        const email = input.email.trim().toLowerCase();
        const otp = input.otp.trim();
        const expected = pendingOtpByEmail.get(email);
        if (!expected || otp !== expected) {
          ensureError("VALIDATION_ERROR", "Invalid OTP", { field: "otp" });
        }
        pendingOtpByEmail.delete(email);
        let account = accountsById.get(accountIdByEmail.get(email) ?? "");
        if (!account) {
          account = accountCreate(email);
        }
        const createdAt = nowMs();
        const session: Session = {
          token: idCreate("session"),
          accountId: account.id,
          createdAt,
          expiresAt: null
        };
        sessionsByToken.set(session.token, { session, accountId: account.id });
        const membershipCount = Array.from(organizationsById.values()).reduce((count, orgState) => {
          return count + (orgState.membershipsByAccountId.has(account.id) ? 1 : 0);
        }, 0);
        return {
          session,
          account,
          onboarding: {
            needsOrganization: membershipCount === 0,
            needsProfile: false
          }
        };
      }),

    authLogout: async (token) =>
      withLatency(() => {
        sessionsByToken.delete(token);
        return { loggedOut: true };
      }),

    meGet: async (token) =>
      withLatency(() => {
        const session = sessionByTokenGet(token);
        const account = accountByTokenGet(token);
        return {
          session,
          account
        };
      }),

    organizationAvailableList: async (token) =>
      withLatency(() => {
        const account = accountByTokenGet(token);
        const items = organizationOrder.map((orgId) => {
          const orgState = orgByIdGet(orgId);
          const membership = orgState.membershipsByAccountId.get(account.id) ?? null;
          const user = membership ? orgState.usersById.get(membership.userId) ?? null : null;
          return {
            organization: { ...orgState.organization },
            membership,
            user
          };
        });
        return {
          items,
          nextCursor: null
        };
      }),

    organizationCreate: async (token, input) =>
      withLatency(() => {
        const account = accountByTokenGet(token);
        const name = input.name.trim();
        if (name.length < 2) {
          ensureError("VALIDATION_ERROR", "Organization name is too short", { field: "name" });
        }
        const desiredSlug = (input.slug ? slugCreate(input.slug) : slugCreate(name)) || `org-${idCreate("slug")}`;
        const slugTaken = Array.from(organizationsById.values()).some(
          (candidate) => candidate.organization.slug === desiredSlug
        );
        if (slugTaken) {
          ensureError("CONFLICT", "Organization slug already exists", { field: "slug" });
        }

        const orgState = orgCreateInternal(name, desiredSlug, account.id);
        const firstName = account.email.split("@")[0] ?? "member";
        const profile = userCreateInternal(orgState, account, {
          firstName,
          lastName: null,
          username: `${slugCreate(firstName)}_${Math.floor(Math.random() * 1000)}`,
          role: "owner"
        });

        const ai = orgAddAiUser(orgState);
        const general = orgAddDefaultChannel(orgState, profile.user.id);
        channelMemberAdd(orgState, general.id, profile.user.id, "owner");
        channelMemberAdd(orgState, general.id, ai.id);

        const welcome: Message = {
          id: idCreate("msg"),
          organizationId: orgState.organization.id,
          channelId: general.id,
          authorId: ai.id,
          text: "Org created. Start by creating channels and shipping updates.",
          mentionUserIds: [],
          threadRootMessageId: null,
          threadReplyCount: 0,
          threadLastReplyAt: null,
          attachments: [],
          reactions: [],
          createdAt: nowMs(),
          updatedAt: nowMs(),
          deletedAt: null
        };
        orgState.messagesByChannelId.get(general.id)?.push(welcome);
        readStateGetOrCreate(orgState, general.id, profile.user.id);

        return {
          organization: { ...orgState.organization },
          user: profile.user,
          membership: profile.membership
        };
      }),

    organizationJoin: async (token, orgId, input) =>
      withLatency(() => {
        const account = accountByTokenGet(token);
        const orgState = orgByIdGet(orgId);
        const existingMembership = orgState.membershipsByAccountId.get(account.id);
        if (existingMembership) {
          const user = orgState.usersById.get(existingMembership.userId);
          if (!user) {
            ensureError("NOT_FOUND", "User profile missing for existing membership");
          }
          return {
            organization: { ...orgState.organization },
            user: user as User,
            membership: existingMembership,
            createdProfile: false
          };
        }

        const firstName = input.firstName?.trim() || account.email.split("@")[0] || "member";
        const lastName = input.lastName?.trim() || null;
        const usernameBase = slugCreate(input.username ?? firstName).replace(/-/g, "_") || "member";
        let username = usernameBase;
        let suffix = 1;
        while (Array.from(orgState.usersById.values()).some((item) => item.username === username)) {
          username = `${usernameBase}${suffix}`;
          suffix += 1;
        }
        const profile = userCreateInternal(orgState, account, {
          firstName,
          lastName,
          username,
          role: "member"
        });

        for (const channel of orgState.channelsById.values()) {
          if (channel.visibility === "public") {
            channelMemberAdd(orgState, channel.id, profile.user.id);
            readStateGetOrCreate(orgState, channel.id, profile.user.id);
            updateEmit(orgState, "member.joined", {
              channelId: channel.id,
              userId: profile.user.id,
              joinedAt: nowMs()
            });
          }
        }
        updateEmit(orgState, "organization.joined", {
          organization: { ...orgState.organization },
          user: profile.user,
          membership: profile.membership
        });
        return {
          organization: { ...orgState.organization },
          user: profile.user,
          membership: profile.membership,
          createdProfile: true
        };
      }),

    organizationGet: async (token, orgId) =>
      withLatency(() => {
        const { orgState } = orgMemberGet(token, orgId);
        return {
          organization: { ...orgState.organization }
        };
      }),

    organizationMembers: async (token, orgId) =>
      withLatency(() => {
        const { orgState } = orgMemberGet(token, orgId);
        const items = Array.from(orgState.membershipsByAccountId.values()).flatMap((membership) => {
          const user = orgState.usersById.get(membership.userId);
          if (!user) {
            return [];
          }
          return [
            {
              membership,
              user: userPreviewCreate(user)
            }
          ];
        });
        return { items };
      }),

    channelList: async (token, orgId, query) =>
      withLatency(() => {
        const { orgState, user } = orgMemberGet(token, orgId);
        const search = query?.search?.trim().toLowerCase();
        const visibility = query?.visibility;
        const channels = Array.from(orgState.channelsById.values())
          .filter((channel) => {
            const byUser = orgState.channelMembersByChannelId.get(channel.id);
            if (!byUser?.has(user.id)) {
              return false;
            }
            if (visibility && channel.visibility !== visibility) {
              return false;
            }
            if (search && !channel.name.toLowerCase().includes(search) && !channel.slug.toLowerCase().includes(search)) {
              return false;
            }
            return true;
          })
          .sort((a, b) => b.updatedAt - a.updatedAt);
        return {
          items: channels,
          nextCursor: null
        };
      }),

    channelCreate: async (token, orgId, input) =>
      withLatency(() => {
        const { orgState, user } = orgMemberGet(token, orgId);
        const name = input.name.trim();
        if (name.length < 2) {
          ensureError("VALIDATION_ERROR", "Channel name is too short", { field: "name" });
        }
        const desiredSlug = (input.slug ? slugCreate(input.slug) : slugCreate(name)) || `channel-${idCreate("slug")}`;
        const slugTaken = Array.from(orgState.channelsById.values()).some((candidate) => candidate.slug === desiredSlug);
        if (slugTaken) {
          ensureError("CONFLICT", "Channel slug already exists", { field: "slug" });
        }
        const createdAt = nowMs();
        const channel: Channel = {
          id: idCreate("channel"),
          organizationId: orgState.organization.id,
          name,
          slug: desiredSlug,
          visibility: input.visibility ?? "public",
          topic: input.topic ?? null,
          createdBy: user.id,
          createdAt,
          updatedAt: createdAt
        };
        orgState.channelsById.set(channel.id, channel);
        orgState.channelMembersByChannelId.set(channel.id, new Map<Id, ChannelMember>());
        orgState.messagesByChannelId.set(channel.id, []);
        channelMemberAdd(orgState, channel.id, user.id, "owner");
        readStateGetOrCreate(orgState, channel.id, user.id);
        updateEmit(orgState, "channel.created", { channel });
        updateEmit(orgState, "member.joined", { channelId: channel.id, userId: user.id, joinedAt: nowMs() });
        return { channel };
      }),

    channelJoin: async (token, orgId, channelId) =>
      withLatency(() => {
        const { orgState, user } = orgMemberGet(token, orgId);
        const channel = orgState.channelsById.get(channelId);
        if (!channel) {
          ensureError("NOT_FOUND", "Channel not found");
        }
        const memberMap = orgState.channelMembersByChannelId.get(channelId);
        if (!memberMap) {
          ensureError("NOT_FOUND", "Channel members not found");
        }
        const ensuredMemberMap = memberMap as Map<Id, ChannelMember>;
        if (ensuredMemberMap.has(user.id)) {
          return {
            member: ensuredMemberMap.get(user.id) as ChannelMember
          };
        }
        const member = channelMemberAdd(orgState, channelId, user.id);
        readStateGetOrCreate(orgState, channelId, user.id);
        updateEmit(orgState, "member.joined", {
          channelId,
          userId: user.id,
          joinedAt: member.joinedAt
        });
        return { member };
      }),

    channelLeave: async (token, orgId, channelId) =>
      withLatency(() => {
        const { orgState, user } = orgMemberGet(token, orgId);
        const memberMap = orgState.channelMembersByChannelId.get(channelId);
        if (!memberMap) {
          ensureError("NOT_FOUND", "Channel members not found");
        }
        const ensuredMemberMap = memberMap as Map<Id, ChannelMember>;
        if (!ensuredMemberMap.has(user.id)) {
          ensureError("FORBIDDEN", "User is not in channel");
        }
        ensuredMemberMap.delete(user.id);
        const leftAt = nowMs();
        updateEmit(orgState, "member.left", { channelId, userId: user.id, leftAt });
        return { channelId, userId: user.id, leftAt };
      }),

    channelMembers: async (token, orgId, channelId) =>
      withLatency(() => {
        const { orgState, user } = orgMemberGet(token, orgId);
        channelMemberRequire(orgState, channelId, user.id);
        const memberMap = orgState.channelMembersByChannelId.get(channelId);
        const items = Array.from(memberMap?.values() ?? []).flatMap((member) => {
          const memberUser = orgState.usersById.get(member.userId);
          if (!memberUser) {
            return [];
          }
          return [
            {
              member,
              user: userPreviewCreate(memberUser)
            }
          ];
        });
        return { items };
      }),

    messageList: async (token, orgId, channelId, query) =>
      withLatency(() => {
        const { orgState, user } = orgMemberGet(token, orgId);
        channelMemberRequire(orgState, channelId, user.id);
        const limit = Math.max(1, Math.min(query?.limit ?? DEFAULT_PAGE_SIZE, 100));
        const source = orgState.messagesByChannelId.get(channelId) ?? [];
        const filtered = source.filter((item) => {
          const root = query?.threadRootMessageId ?? null;
          return item.threadRootMessageId === root;
        });

        const idIndexMap = new Map<Cursor, number>();
        filtered.forEach((message, index) => {
          idIndexMap.set(message.id, index);
        });

        let startIndex = Math.max(filtered.length - limit, 0);
        let endIndex = filtered.length;

        if (query?.around) {
          const aroundIndex = idIndexMap.get(query.around);
          if (aroundIndex !== undefined) {
            const half = Math.floor(limit / 2);
            startIndex = Math.max(0, aroundIndex - half);
            endIndex = Math.min(filtered.length, startIndex + limit);
            startIndex = Math.max(0, endIndex - limit);
          }
        } else if (query?.before) {
          const beforeIndex = idIndexMap.get(query.before);
          if (beforeIndex !== undefined) {
            endIndex = beforeIndex;
            startIndex = Math.max(0, endIndex - limit);
          }
        } else if (query?.after) {
          const afterIndex = idIndexMap.get(query.after);
          if (afterIndex !== undefined) {
            startIndex = Math.min(filtered.length, afterIndex + 1);
            endIndex = Math.min(filtered.length, startIndex + limit);
          }
        }

        const selected = filtered.slice(startIndex, endIndex);
        const items = selected.map((message) => messageViewCreate(orgState, message));
        const hasMoreOlder = startIndex > 0;
        const hasMoreNewer = endIndex < filtered.length;
        return {
          items,
          page: {
            limit,
            nextCursor: hasMoreNewer ? filtered[endIndex - 1]?.id ?? null : null,
            prevCursor: hasMoreOlder ? filtered[startIndex]?.id ?? null : null,
            hasMoreOlder,
            hasMoreNewer
          }
        };
      }),

    messageSend: async (token, orgId, input) =>
      withLatency(() => {
        const { orgState, user } = orgMemberGet(token, orgId);
        const channel = channelMemberRequire(orgState, input.channelId, user.id);
        const text = input.text.trim();
        if (text.length === 0) {
          ensureError("VALIDATION_ERROR", "Message text cannot be empty", { field: "text" });
        }
        const createdAt = nowMs();
        const attachments = (input.attachmentIds ?? []).flatMap((attachmentId) => {
          const attachment = orgState.filesById.get(attachmentId);
          return attachment ? [attachment] : [];
        });
        const message: Message = {
          id: idCreate("msg"),
          organizationId: orgState.organization.id,
          channelId: channel.id,
          authorId: user.id,
          text,
          mentionUserIds: mentionsParse(orgState, text),
          threadRootMessageId: input.threadRootMessageId ?? null,
          threadReplyCount: 0,
          threadLastReplyAt: null,
          attachments,
          reactions: [],
          createdAt,
          updatedAt: createdAt,
          deletedAt: null,
          clientMessageId: input.clientMessageId
        };
        const messages = orgState.messagesByChannelId.get(channel.id);
        if (!messages) {
          ensureError("NOT_FOUND", "Channel message store not found");
        }
        (messages as Message[]).push(message);
        channel.updatedAt = createdAt;

        if (message.threadRootMessageId) {
          const rootResult = messageFind(orgState, message.threadRootMessageId);
          rootResult.message.threadReplyCount += 1;
          rootResult.message.threadLastReplyAt = createdAt;
          rootResult.message.updatedAt = createdAt;
          updateEmit(orgState, "thread.updated", {
            channelId: channel.id,
            threadRootMessageId: rootResult.message.id,
            threadReplyCount: rootResult.message.threadReplyCount,
            threadLastReplyAt: rootResult.message.threadLastReplyAt
          });
        }

        const readState = readStateGetOrCreate(orgState, channel.id, user.id);
        readState.lastReadAtMs = createdAt;
        readState.lastReadMessageId = message.id;
        readState.updatedAt = createdAt;
        readState.unreadCount = unreadCountCompute(orgState, channel.id, user.id, readState.lastReadAtMs);
        updateEmit(orgState, "read.updated", {
          channelId: channel.id,
          userId: user.id,
          readState: { ...readState }
        });

        const messageView = messageViewCreate(orgState, message);
        updateEmit(orgState, "message.created", { message: messageView });
        return { message: messageView };
      }),

    messageEdit: async (token, orgId, messageId, input) =>
      withLatency(() => {
        const { orgState, user } = orgMemberGet(token, orgId);
        const result = messageFind(orgState, messageId);
        channelMemberRequire(orgState, result.channelId, user.id);
        if (result.message.authorId !== user.id) {
          ensureError("FORBIDDEN", "Only the author can edit this message");
        }
        const text = input.text.trim();
        if (text.length === 0) {
          ensureError("VALIDATION_ERROR", "Message text cannot be empty", { field: "text" });
        }
        result.message.text = text;
        result.message.mentionUserIds = mentionsParse(orgState, text);
        result.message.updatedAt = nowMs();
        const view = messageViewCreate(orgState, result.message);
        updateEmit(orgState, "message.updated", { message: view });
        return { message: view };
      }),

    messageDelete: async (token, orgId, messageId) =>
      withLatency(() => {
        const { orgState, user } = orgMemberGet(token, orgId);
        const result = messageFind(orgState, messageId);
        channelMemberRequire(orgState, result.channelId, user.id);
        if (result.message.authorId !== user.id) {
          ensureError("FORBIDDEN", "Only the author can delete this message");
        }
        const deletedAt = nowMs();
        result.message.deletedAt = deletedAt;
        result.message.updatedAt = deletedAt;
        result.message.text = "[deleted]";
        updateEmit(orgState, "message.deleted", {
          messageId: result.message.id,
          channelId: result.channelId,
          deletedAt
        });
        return {
          messageId: result.message.id,
          channelId: result.channelId,
          deletedAt
        };
      }),

    messageReactionAdd: async (token, orgId, messageId, input) =>
      withLatency(() => {
        const { orgState, user } = orgMemberGet(token, orgId);
        const result = messageFind(orgState, messageId);
        channelMemberRequire(orgState, result.channelId, user.id);
        reactionRequire(input.shortcode);
        let reaction = result.message.reactions.find((item) => item.shortcode === input.shortcode);
        if (!reaction) {
          reaction = {
            shortcode: input.shortcode,
            userIds: [],
            count: 0,
            updatedAt: nowMs()
          };
          result.message.reactions.push(reaction);
        }
        if (!reaction.userIds.includes(user.id)) {
          reaction.userIds.push(user.id);
        }
        reaction.count = reaction.userIds.length;
        reaction.updatedAt = nowMs();
        updateEmit(orgState, "reaction.updated", {
          channelId: result.channelId,
          messageId,
          reactions: result.message.reactions.map((item) => ({ ...item, userIds: [...item.userIds] }))
        });
        return {
          messageId,
          reactions: result.message.reactions.map((item) => ({ ...item, userIds: [...item.userIds] }))
        };
      }),

    messageReactionRemove: async (token, orgId, messageId, input) =>
      withLatency(() => {
        const { orgState, user } = orgMemberGet(token, orgId);
        const result = messageFind(orgState, messageId);
        channelMemberRequire(orgState, result.channelId, user.id);
        reactionRequire(input.shortcode);
        const reaction = result.message.reactions.find((item) => item.shortcode === input.shortcode);
        if (reaction) {
          reaction.userIds = reaction.userIds.filter((item) => item !== user.id);
          reaction.count = reaction.userIds.length;
          reaction.updatedAt = nowMs();
          if (reaction.count === 0) {
            result.message.reactions = result.message.reactions.filter((item) => item.shortcode !== input.shortcode);
          }
        }
        updateEmit(orgState, "reaction.updated", {
          channelId: result.channelId,
          messageId,
          reactions: result.message.reactions.map((item) => ({ ...item, userIds: [...item.userIds] }))
        });
        return {
          messageId,
          reactions: result.message.reactions.map((item) => ({ ...item, userIds: [...item.userIds] }))
        };
      }),

    fileUploadInit: async (token, orgId, input) =>
      withLatency(() => {
        const { orgState, user } = orgMemberGet(token, orgId);
        if (input.sizeBytes <= 0) {
          ensureError("VALIDATION_ERROR", "File size must be positive", { field: "sizeBytes" });
        }
        const attachmentId = idCreate("file");
        const kind = input.mimeType.startsWith("image/")
          ? "image"
          : input.mimeType.startsWith("audio/")
            ? "audio"
            : "document";
        const attachment: FileAttachment = {
          id: attachmentId,
          organizationId: orgState.organization.id,
          kind,
          filename: input.filename,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          hashSha256: input.hashSha256,
          storageKey: `mock/${attachmentId}/${input.filename}`,
          createdBy: user.id,
          createdAt: nowMs()
        };
        orgState.filesById.set(attachmentId, attachment);
        return {
          attachmentId,
          uploadUrl: `https://mock.daycare.local/upload/${attachmentId}`,
          uploadHeaders: {
            "x-mock-upload": "true"
          },
          expiresAt: nowMs() + 1000 * 60 * 60
        };
      }),

    typingUpsert: async (token, orgId, channelId, input) =>
      withLatency(() => {
        const { orgState, user } = orgMemberGet(token, orgId);
        channelMemberRequire(orgState, channelId, user.id);
        const threadRootMessageId = input.threadRootMessageId ?? null;
        const key = typingKeyCreate(channelId, threadRootMessageId);
        let bucket = orgState.typingByChannelThreadKey.get(key);
        if (!bucket) {
          bucket = new Map<Id, TypingIndicator>();
          orgState.typingByChannelThreadKey.set(key, bucket);
        }
        const ttlMs = Math.max(1000, Math.min(input.ttlMs ?? 5000, 15000));
        const typing: TypingIndicator = {
          organizationId: orgState.organization.id,
          channelId,
          userId: user.id,
          threadRootMessageId,
          startedAt: nowMs(),
          expiresAt: nowMs() + ttlMs,
          updatedAt: nowMs()
        };
        if (!input.isTyping) {
          bucket.delete(user.id);
          typing.expiresAt = nowMs();
        } else {
          bucket.set(user.id, typing);
        }
        typingBroadcast(orgState, channelId, threadRootMessageId);
        return { typing };
      }),

    typingList: async (token, orgId, channelId) =>
      withLatency(() => {
        const { orgState, user } = orgMemberGet(token, orgId);
        channelMemberRequire(orgState, channelId, user.id);
        const key = typingKeyCreate(channelId, null);
        const bucket = orgState.typingByChannelThreadKey.get(key);
        const items = Array.from(bucket?.values() ?? []).filter((item) => item.expiresAt > nowMs());
        return { items };
      }),

    readStateSet: async (token, orgId, channelId, input) =>
      withLatency(() => {
        const { orgState, user } = orgMemberGet(token, orgId);
        channelMemberRequire(orgState, channelId, user.id);
        const readState = readStateGetOrCreate(orgState, channelId, user.id);
        readState.lastReadAtMs = Math.max(readState.lastReadAtMs, input.lastReadAtMs);
        readState.lastReadMessageId = input.lastReadMessageId ?? readState.lastReadMessageId;
        readState.updatedAt = nowMs();
        readState.unreadCount = unreadCountCompute(orgState, channelId, user.id, readState.lastReadAtMs);
        updateEmit(orgState, "read.updated", {
          channelId,
          userId: user.id,
          readState: { ...readState }
        });
        return {
          readState: { ...readState }
        };
      }),

    readStateGet: async (token, orgId, channelId) =>
      withLatency(() => {
        const { orgState, user } = orgMemberGet(token, orgId);
        channelMemberRequire(orgState, channelId, user.id);
        const readState = readStateGetOrCreate(orgState, channelId, user.id);
        return {
          readState: { ...readState }
        };
      }),

    updatesDiff: async (token, orgId, input) =>
      withLatency(() => {
        const { orgState } = orgMemberGet(token, orgId);
        const offset = Math.max(0, input.offset);
        const oldestRetained = orgState.updates[0]?.seqno ?? orgState.headOffset + 1;
        if (offset < oldestRetained - 1) {
          return {
            headOffset: orgState.headOffset,
            resetRequired: true,
            updates: []
          };
        }
        const updates = orgState.updates.filter((update) => update.seqno > offset);
        return {
          headOffset: orgState.headOffset,
          resetRequired: false,
          updates
        };
      }),

    updatesStreamSubscribe: async (token, orgId, listener) =>
      withLatency(() => {
        orgMemberGet(token, orgId);
        const orgState = orgByIdGet(orgId);
        orgState.subscribers.add(listener);
        return {
          headOffset: orgState.headOffset,
          close: () => {
            orgState.subscribers.delete(listener);
          }
        };
      }),

    updatesHoleSimulate: async (orgId) =>
      withLatency(() => {
        const orgState = orgByIdGet(orgId);
        orgState.dropNextStreamEvent = true;
        return { armed: true };
      })
  };
}
