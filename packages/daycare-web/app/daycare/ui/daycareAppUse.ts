import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiClientCreate } from "../api/apiClientCreate";
import { syncEngineCreate, type SyncEngine } from "../sync/syncEngineCreate";
import type {
  Channel,
  Id,
  Message,
  MessageReaction,
  MessageAttachment,
  Organization,
  ReadState,
  TypingState,
  UpdateEnvelope,
  User
} from "../types";

type AppPhase = "auth" | "orgs" | "workspace";

type SyncState = "idle" | "syncing" | "live" | "recovering";

type UiReaction = {
  shortcode: string;
  userIds: Id[];
  count: number;
  updatedAt: number;
};

type UiMessage = {
  id: Id;
  channelId: Id;
  authorId: Id;
  author: Message["sender"];
  text: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
  threadRootMessageId: Id | null;
  threadReplyCount: number;
  threadLastReplyAt: number | null;
  reactions: UiReaction[];
  attachments: MessageAttachment[];
  pending?: boolean;
};

type ContextState = {
  token: string;
  orgId: Id;
  userId: Id;
};

type DaycareModel = {
  phase: AppPhase;
  syncState: SyncState;
  syncOffset: number;
  busy: boolean;
  error: string | null;
  email: string;
  orgs: Organization[];
  activeOrganization: Organization | null;
  activeUser: User | null;
  channels: Channel[];
  selectedChannelId: Id | null;
  rootMessages: UiMessage[];
  activeThreadRootId: Id | null;
  threadMessages: UiMessage[];
  membersById: Record<Id, Message["sender"]>;
  typingInSelected: TypingState[];
  readStatesByChannelId: Record<Id, ReadState>;
  composerText: string;
  emailSet: (email: string) => void;
  composerTextSet: (value: string) => void;
  login: () => Promise<void>;
  organizationOpen: (orgId: Id) => Promise<void>;
  organizationCreate: (input: { name: string; slug: string; firstName: string; username: string }) => Promise<void>;
  channelSelect: (channelId: Id) => Promise<void>;
  channelCreate: (input: { name: string; topic?: string | null }) => Promise<void>;
  messageSend: () => Promise<void>;
  threadOpen: (rootMessageId: Id) => Promise<void>;
  threadClose: () => void;
  reactionToggle: (messageId: Id, shortcode: string) => Promise<void>;
  logout: () => Promise<void>;
};

const channelSlugCreate = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 32);

const byDateAsc = (a: UiMessage, b: UiMessage): number => a.createdAt - b.createdAt;

const errorToMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unexpected error";
};

const reactionsAggregate = (reactions: MessageReaction[]): UiReaction[] => {
  const grouped = new Map<string, UiReaction>();
  for (const reaction of reactions) {
    const existing = grouped.get(reaction.shortcode) ?? {
      shortcode: reaction.shortcode,
      userIds: [],
      count: 0,
      updatedAt: 0
    };
    existing.userIds.push(reaction.userId);
    existing.count = existing.userIds.length;
    existing.updatedAt = Math.max(existing.updatedAt, reaction.createdAt);
    grouped.set(reaction.shortcode, existing);
  }
  return Array.from(grouped.values());
};

const messageToUi = (message: Message): UiMessage => ({
  id: message.id,
  channelId: message.chatId,
  authorId: message.senderUserId,
  author: message.sender,
  text: message.text,
  createdAt: message.createdAt,
  updatedAt: message.editedAt ?? message.createdAt,
  deletedAt: message.deletedAt,
  threadRootMessageId: message.threadId ?? null,
  threadReplyCount: message.threadReplyCount,
  threadLastReplyAt: message.threadLastReplyAt,
  reactions: reactionsAggregate(message.reactions),
  attachments: message.attachments
});

const messagesUpsert = (messages: UiMessage[], incoming: UiMessage): UiMessage[] => {
  const existingIndex = messages.findIndex((item) => item.id === incoming.id);
  if (existingIndex >= 0) {
    const next = [...messages];
    next[existingIndex] = incoming;
    return next.sort(byDateAsc);
  }
  return [...messages, incoming].sort(byDateAsc);
};

export function daycareAppUse(): DaycareModel {
  const apiBase = (import.meta as { env?: Record<string, string> }).env?.VITE_API_BASE ?? "http://localhost:3005";
  const api = useMemo(() => apiClientCreate(apiBase), [apiBase]);

  const [phase, phaseSet] = useState<AppPhase>("auth");
  const [syncState, syncStateSet] = useState<SyncState>("idle");
  const [syncOffset, syncOffsetSet] = useState(0);
  const [busy, busySet] = useState(false);
  const [error, errorSet] = useState<string | null>(null);

  const [email, emailSet] = useState("");
  const [sessionToken, sessionTokenSet] = useState<string | null>(null);

  const [orgs, orgsSet] = useState<Organization[]>([]);
  const [activeOrganization, activeOrganizationSet] = useState<Organization | null>(null);
  const [activeUser, activeUserSet] = useState<User | null>(null);

  const [channels, channelsSet] = useState<Channel[]>([]);
  const [selectedChannelId, selectedChannelIdSet] = useState<Id | null>(null);

  const [rootMessagesByChannelId, rootMessagesByChannelIdSet] = useState<Record<Id, UiMessage[]>>({});
  const [threadMessagesByRootId, threadMessagesByRootIdSet] = useState<Record<Id, UiMessage[]>>({});
  const [activeThreadRootId, activeThreadRootIdSet] = useState<Id | null>(null);

  const [membersById, membersByIdSet] = useState<Record<Id, Message["sender"]>>({});
  const [typingByChannelId, typingByChannelIdSet] = useState<Record<Id, TypingState[]>>({});
  const [readStatesByChannelId, readStatesByChannelIdSet] = useState<Record<Id, ReadState>>({});
  const [composerText, composerTextSet] = useState("");

  const contextRef = useRef<ContextState | null>(null);
  const syncEngineRef = useRef<SyncEngine | null>(null);
  const selectedChannelIdRef = useRef<Id | null>(null);
  const lastTypingSignalAtRef = useRef(0);

  const stateReset = useCallback(() => {
    phaseSet("auth");
    syncStateSet("idle");
    syncOffsetSet(0);
    sessionTokenSet(null);
    orgsSet([]);
    activeOrganizationSet(null);
    activeUserSet(null);
    channelsSet([]);
    selectedChannelIdSet(null);
    rootMessagesByChannelIdSet({});
    threadMessagesByRootIdSet({});
    activeThreadRootIdSet(null);
    membersByIdSet({});
    typingByChannelIdSet({});
    readStatesByChannelIdSet({});
    composerTextSet("");
    contextRef.current = null;
    syncEngineRef.current?.stop();
    syncEngineRef.current = null;
  }, []);

  const membersLoad = useCallback(
    async (token: string, orgId: Id): Promise<void> => {
      const response = await api.organizationMembers(token, orgId);
      const next: Record<Id, Message["sender"]> = {};
      for (const member of response.members) {
        next[member.id] = {
          id: member.id,
          kind: member.kind,
          username: member.username,
          firstName: member.firstName,
          lastName: member.lastName,
          avatarUrl: member.avatarUrl
        };
      }
      membersByIdSet(next);
    },
    [api]
  );

  const channelAndReadBootstrap = useCallback(
    async (token: string, orgId: Id): Promise<Channel[]> => {
      const channelsResponse = await api.channelList(token, orgId);
      channelsSet(channelsResponse.channels);
      const reads = await Promise.all(
        channelsResponse.channels.map(async (channel) => {
          const read = await api.readStateGet(token, orgId, channel.id);
          return [channel.id, read] as const;
        })
      );
      const readMap: Record<Id, ReadState> = {};
      for (const [channelId, read] of reads) {
        readMap[channelId] = read;
      }
      readStatesByChannelIdSet(readMap);
      return channelsResponse.channels;
    },
    [api]
  );

  const channelRootMessagesLoad = useCallback(
    async (token: string, orgId: Id, channelId: Id): Promise<void> => {
      const list = await api.messageList(token, orgId, channelId, { limit: 80 });
      rootMessagesByChannelIdSet((previous) => ({
        ...previous,
        [channelId]: list.messages.map(messageToUi)
      }));
    },
    [api]
  );

  const threadMessagesLoad = useCallback(
    async (token: string, orgId: Id, channelId: Id, rootMessageId: Id): Promise<void> => {
      const list = await api.messageList(token, orgId, channelId, {
        limit: 80,
        threadId: rootMessageId
      });
      threadMessagesByRootIdSet((previous) => ({
        ...previous,
        [rootMessageId]: list.messages.map(messageToUi)
      }));
    },
    [api]
  );

  const channelTypingLoad = useCallback(
    async (token: string, orgId: Id, channelId: Id): Promise<void> => {
      const typing = await api.typingList(token, orgId, channelId);
      typingByChannelIdSet((previous) => ({
        ...previous,
        [channelId]: typing.typing
      }));
    },
    [api]
  );

  const channelReadMark = useCallback(
    async (token: string, orgId: Id, channelId: Id): Promise<void> => {
      const read = await api.readStateSet(token, orgId, channelId);
      readStatesByChannelIdSet((previous) => ({
        ...previous,
        [channelId]: {
          chatId: read.chatId,
          lastReadAt: read.lastReadAt,
          unreadCount: 0
        }
      }));
    },
    [api]
  );

  const messageRefresh = useCallback(
    async (token: string, orgId: Id, channelId: Id): Promise<void> => {
      const list = await api.messageList(token, orgId, channelId, { limit: 80 });
      rootMessagesByChannelIdSet((previous) => ({
        ...previous,
        [channelId]: list.messages.map(messageToUi)
      }));
    },
    [api]
  );

  const updateApply = useCallback(
    (update: UpdateEnvelope): void => {
      const context = contextRef.current;
      if (!context) {
        return;
      }
      const { orgId, token } = context;

      switch (update.eventType) {
        case "channel.created":
        case "channel.updated":
        case "channel.member.joined":
        case "channel.member.left":
          void channelAndReadBootstrap(token, orgId);
          break;
        case "organization.member.joined":
        case "user.updated":
          void membersLoad(token, orgId);
          break;
        case "message.created":
        case "message.updated":
        case "message.deleted":
        case "message.reaction": {
          const payload = update.payload as { channelId?: string };
          if (payload.channelId) {
            void messageRefresh(token, orgId, payload.channelId);
            if (activeThreadRootId) {
              void threadMessagesLoad(token, orgId, payload.channelId, activeThreadRootId);
            }
          }
          break;
        }
        case "user.typing": {
          const payload = update.payload as {
            channelId?: string;
            userId?: string;
            threadRootMessageId?: string | null;
            expiresAt?: number;
          };
          const channelId = payload.channelId;
          if (!channelId || payload.threadRootMessageId) {
            return;
          }
          typingByChannelIdSet((previous) => {
            const current = previous[channelId] ?? [];
            const updated = current.filter((item) => item.userId !== payload.userId);
            if (payload.userId && payload.expiresAt) {
              const member = membersById[payload.userId];
              if (member) {
                updated.unshift({
                  userId: payload.userId,
                  username: member.username,
                  firstName: member.firstName,
                  expiresAt: payload.expiresAt
                });
              }
            }
            return {
              ...previous,
              [channelId]: updated
            };
          });
          break;
        }
        default:
          break;
      }
    },
    [activeThreadRootId, channelAndReadBootstrap, membersLoad, messageRefresh, threadMessagesLoad, membersById]
  );

  const workspaceStart = useCallback(
    async (token: string, orgId: Id, user: User): Promise<void> => {
      busySet(true);
      errorSet(null);
      syncStateSet("syncing");
      try {
        const org = await api.organizationGet(token, orgId);
        activeOrganizationSet(org.organization);
        activeUserSet(user);

        contextRef.current = {
          token,
          orgId,
          userId: user.id
        };

        await membersLoad(token, orgId);
        const freshChannels = await channelAndReadBootstrap(token, orgId);
        const selected = freshChannels[0]?.id ?? null;
        selectedChannelIdSet(selected);
        rootMessagesByChannelIdSet({});
        threadMessagesByRootIdSet({});
        activeThreadRootIdSet(null);
        typingByChannelIdSet({});
        composerTextSet("");

        if (selected) {
          await channelRootMessagesLoad(token, orgId, selected);
          await channelTypingLoad(token, orgId, selected);
          await channelReadMark(token, orgId, selected);
        }

        syncEngineRef.current?.stop();
        const engine = syncEngineCreate({
          updatesDiff: (offset) => api.updatesDiff(token, orgId, { offset }),
          updatesStreamSubscribe: (onUpdate, onReady) => api.updatesStreamSubscribe(token, orgId, onUpdate, onReady),
          onUpdate: updateApply,
          onOffset: syncOffsetSet,
          onResetRequired: async () => {
            await channelAndReadBootstrap(token, orgId);
          },
          onState: (state) => {
            syncStateSet(state);
          },
          onError: (syncError) => {
            errorSet(errorToMessage(syncError));
          }
        });
        syncEngineRef.current = engine;
        await engine.start();
        syncStateSet("live");
        phaseSet("workspace");
      } catch (workspaceError) {
        errorSet(errorToMessage(workspaceError));
      } finally {
        busySet(false);
      }
    },
    [api, channelAndReadBootstrap, channelReadMark, channelRootMessagesLoad, channelTypingLoad, membersLoad, updateApply]
  );

  const login = useCallback(async (): Promise<void> => {
    busySet(true);
    errorSet(null);
    try {
      const auth = await api.authLogin(email.trim().toLowerCase());
      sessionTokenSet(auth.token);
      const me = await api.meGet(auth.token);
      orgsSet(me.organizations);
      phaseSet("orgs");
    } catch (loginError) {
      errorSet(errorToMessage(loginError));
    } finally {
      busySet(false);
    }
  }, [api, email]);

  const organizationOpen = useCallback(
    async (orgId: Id): Promise<void> => {
      const token = sessionToken;
      if (!token) {
        return;
      }
      busySet(true);
      errorSet(null);
      try {
        const profile = await api.profileGet(token, orgId);
        await workspaceStart(token, orgId, profile.profile);
      } catch (openError) {
        errorSet(errorToMessage(openError));
      } finally {
        busySet(false);
      }
    },
    [api, sessionToken, workspaceStart]
  );

  const organizationCreate = useCallback(
    async (input: { name: string; slug: string; firstName: string; username: string }): Promise<void> => {
      const token = sessionToken;
      if (!token) {
        return;
      }
      busySet(true);
      errorSet(null);
      try {
        const created = await api.organizationCreate(token, input);
        const profile = await api.profileGet(token, created.organization.id);
        const me = await api.meGet(token);
        orgsSet(me.organizations);
        await workspaceStart(token, created.organization.id, profile.profile);
      } catch (createError) {
        errorSet(errorToMessage(createError));
      } finally {
        busySet(false);
      }
    },
    [api, sessionToken, workspaceStart]
  );

  const channelSelect = useCallback(
    async (channelId: Id): Promise<void> => {
      const context = contextRef.current;
      if (!context) {
        return;
      }
      const { token, orgId } = context;
      selectedChannelIdSet(channelId);
      activeThreadRootIdSet(null);
      composerTextSet("");
      await channelRootMessagesLoad(token, orgId, channelId);
      await channelTypingLoad(token, orgId, channelId);
      await channelReadMark(token, orgId, channelId);
    },
    [channelReadMark, channelRootMessagesLoad, channelTypingLoad]
  );

  const channelCreate = useCallback(
    async (input: { name: string; topic?: string | null }): Promise<void> => {
      const context = contextRef.current;
      if (!context) {
        return;
      }
      const { token, orgId } = context;
      busySet(true);
      errorSet(null);
      try {
        const created = await api.channelCreate(token, orgId, {
          name: input.name,
          topic: input.topic ?? null,
          visibility: "public"
        });
        channelsSet((previous) => [...previous, created.channel]);
        await channelSelect(created.channel.id);
      } catch (createError) {
        errorSet(errorToMessage(createError));
      } finally {
        busySet(false);
      }
    },
    [api, channelSelect]
  );

  const typingSignal = useCallback(
    async (isTyping: boolean): Promise<void> => {
      const context = contextRef.current;
      if (!context || !selectedChannelId) {
        return;
      }
      if (!isTyping) {
        return;
      }
      const now = Date.now();
      if (now - lastTypingSignalAtRef.current < 1500) {
        return;
      }
      lastTypingSignalAtRef.current = now;
      try {
        await api.typingUpsert(context.token, context.orgId, selectedChannelId, { threadRootMessageId: null });
      } catch {
        // Ignore typing failures.
      }
    },
    [api, selectedChannelId]
  );

  const messageSend = useCallback(async (): Promise<void> => {
    const context = contextRef.current;
    const channelId = selectedChannelId;
    const user = activeUser;
    if (!context || !channelId || !user) {
      return;
    }
    const text = composerText.trim();
    if (text.length === 0) {
      return;
    }

    const optimisticId = `optimistic_${Date.now()}`;
    const optimisticMessage: UiMessage = {
      id: optimisticId,
      channelId,
      authorId: user.id,
      author: {
        id: user.id,
        kind: user.kind,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl
      },
      text,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deletedAt: null,
      threadRootMessageId: activeThreadRootId,
      threadReplyCount: 0,
      threadLastReplyAt: null,
      reactions: [],
      attachments: [],
      pending: true
    };

    if (activeThreadRootId) {
      threadMessagesByRootIdSet((previous) => ({
        ...previous,
        [activeThreadRootId]: messagesUpsert(previous[activeThreadRootId] ?? [], optimisticMessage)
      }));
    } else {
      rootMessagesByChannelIdSet((previous) => ({
        ...previous,
        [channelId]: messagesUpsert(previous[channelId] ?? [], optimisticMessage)
      }));
    }

    composerTextSet("");

    try {
      const sent = await api.messageSend(context.token, context.orgId, {
        channelId,
        text,
        threadId: activeThreadRootId
      });
      const resolved = messageToUi(sent.message);
      if (activeThreadRootId) {
        threadMessagesByRootIdSet((previous) => ({
          ...previous,
          [activeThreadRootId]: (previous[activeThreadRootId] ?? [])
            .filter((item) => item.id !== optimisticId)
            .concat(resolved)
            .sort(byDateAsc)
        }));
      } else {
        rootMessagesByChannelIdSet((previous) => ({
          ...previous,
          [channelId]: (previous[channelId] ?? [])
            .filter((item) => item.id !== optimisticId)
            .concat(resolved)
            .sort(byDateAsc)
        }));
      }
      await channelReadMark(context.token, context.orgId, channelId);
    } catch (sendError) {
      errorSet(errorToMessage(sendError));
      if (activeThreadRootId) {
        threadMessagesByRootIdSet((previous) => ({
          ...previous,
          [activeThreadRootId]: (previous[activeThreadRootId] ?? []).filter((item) => item.id !== optimisticId)
        }));
      } else {
        rootMessagesByChannelIdSet((previous) => ({
          ...previous,
          [channelId]: (previous[channelId] ?? []).filter((item) => item.id !== optimisticId)
        }));
      }
    }
  }, [activeThreadRootId, activeUser, api, channelReadMark, composerText, selectedChannelId]);

  const threadOpen = useCallback(
    async (rootMessageId: Id): Promise<void> => {
      const context = contextRef.current;
      if (!context || !selectedChannelId) {
        return;
      }
      activeThreadRootIdSet(rootMessageId);
      await threadMessagesLoad(context.token, context.orgId, selectedChannelId, rootMessageId);
    },
    [selectedChannelId, threadMessagesLoad]
  );

  const threadClose = useCallback((): void => {
    activeThreadRootIdSet(null);
  }, []);

  const reactionToggle = useCallback(
    async (messageId: Id, shortcode: string): Promise<void> => {
      const context = contextRef.current;
      if (!context || !selectedChannelId) {
        return;
      }
      const source = rootMessagesByChannelId[selectedChannelId] ?? [];
      const message = source.find((item) => item.id === messageId);
      const userId = activeUser?.id;
      if (!message || !userId) {
        return;
      }
      const existing = message.reactions.find((reaction) => reaction.shortcode === shortcode);
      const already = existing?.userIds.includes(userId) ?? false;
      if (already) {
        await api.messageReactionRemove(context.token, context.orgId, messageId, { shortcode });
      } else {
        await api.messageReactionAdd(context.token, context.orgId, messageId, { shortcode });
      }
      if (selectedChannelId) {
        await messageRefresh(context.token, context.orgId, selectedChannelId);
      }
    },
    [activeUser?.id, api, messageRefresh, rootMessagesByChannelId, selectedChannelId]
  );

  const logout = useCallback(async (): Promise<void> => {
    if (sessionToken) {
      try {
        await api.authLogout(sessionToken);
      } catch {
        // ignore
      }
    }
    stateReset();
  }, [api, sessionToken, stateReset]);

  const composerTextSetWrapped = useCallback(
    (value: string): void => {
      composerTextSet(value);
      void typingSignal(value.trim().length > 0);
    },
    [typingSignal]
  );

  useEffect(() => {
    selectedChannelIdRef.current = selectedChannelId;
  }, [selectedChannelId]);

  useEffect(() => {
    return () => {
      syncEngineRef.current?.stop();
    };
  }, []);

  const rootMessages = selectedChannelId ? rootMessagesByChannelId[selectedChannelId] ?? [] : [];
  const threadMessages = activeThreadRootId ? threadMessagesByRootId[activeThreadRootId] ?? [] : [];
  const typingInSelected = selectedChannelId ? typingByChannelId[selectedChannelId] ?? [] : [];

  return {
    phase,
    syncState,
    syncOffset,
    busy,
    error,
    email,
    orgs,
    activeOrganization,
    activeUser,
    channels,
    selectedChannelId,
    rootMessages,
    activeThreadRootId,
    threadMessages,
    membersById,
    typingInSelected,
    readStatesByChannelId,
    composerText,
    emailSet,
    composerTextSet: composerTextSetWrapped,
    login,
    organizationOpen,
    organizationCreate,
    channelSelect,
    channelCreate,
    messageSend,
    threadOpen,
    threadClose,
    reactionToggle,
    logout
  };
}
