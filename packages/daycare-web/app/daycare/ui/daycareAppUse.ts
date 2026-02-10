import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mockServerSingletonGet } from "../mock/mockServerSingletonGet";
import { syncEngineCreate, type SyncEngine } from "../sync/syncEngineCreate";
import type {
  Channel,
  ChannelReadState,
  Id,
  MessageView,
  Organization,
  OrganizationAvailableResponse,
  OrganizationMembership,
  TypingIndicator,
  UpdatesDiffItem,
  User
} from "../types";

type AppPhase = "auth" | "orgs" | "workspace";
type SyncState = "idle" | "syncing" | "live" | "recovering";

type OrganizationCard = {
  organization: Organization;
  membership: OrganizationMembership | null;
  user: User | null;
};

type PendingMessage = {
  channelId: Id;
  optimisticMessageId: Id;
  threadRootMessageId: Id | null;
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
  otp: string;
  otpRequested: boolean;
  sessionToken: string | null;
  organizations: OrganizationCard[];
  activeOrganization: Organization | null;
  activeUser: User | null;
  channels: Channel[];
  selectedChannelId: Id | null;
  rootMessages: MessageView[];
  activeThreadRootId: Id | null;
  threadMessages: MessageView[];
  membersById: Record<Id, MessageView["author"]>;
  typingInSelected: TypingIndicator[];
  readStatesByChannelId: Record<Id, ChannelReadState>;
  composerText: string;
  emailSet: (email: string) => void;
  otpSet: (otp: string) => void;
  composerTextSet: (value: string) => void;
  requestOtp: () => Promise<void>;
  verifyOtp: () => Promise<void>;
  organizationOpen: (orgId: Id) => Promise<void>;
  organizationCreate: (name: string) => Promise<void>;
  channelSelect: (channelId: Id) => Promise<void>;
  channelCreate: (name: string) => Promise<void>;
  messageSend: () => Promise<void>;
  threadOpen: (rootMessageId: Id) => Promise<void>;
  threadClose: () => void;
  reactionToggle: (messageId: Id, shortcode: string) => Promise<void>;
  holeSimulate: () => Promise<void>;
  logout: () => Promise<void>;
};

const byDateAsc = (a: MessageView, b: MessageView): number => a.message.createdAt - b.message.createdAt;

const userPreview = (user: User): MessageView["author"] => ({
  id: user.id,
  kind: user.kind,
  username: user.username,
  firstName: user.firstName,
  lastName: user.lastName,
  avatarUrl: user.avatarUrl
});

const errorToMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unexpected error";
};

const messagesUpsert = (messages: MessageView[], incoming: MessageView): MessageView[] => {
  const existingIndex = messages.findIndex((item) => item.message.id === incoming.message.id);
  if (existingIndex >= 0) {
    const next = [...messages];
    next[existingIndex] = incoming;
    return next.sort(byDateAsc);
  }
  return [...messages, incoming].sort(byDateAsc);
};

const messagePatch = (messages: MessageView[], messageId: Id, patch: (message: MessageView) => MessageView): MessageView[] => {
  const index = messages.findIndex((item) => item.message.id === messageId);
  if (index < 0) {
    return messages;
  }
  const next = [...messages];
  next[index] = patch(next[index] as MessageView);
  return next;
};

export function daycareAppUse(): DaycareModel {
  const server = useMemo(() => mockServerSingletonGet(), []);

  const [phase, phaseSet] = useState<AppPhase>("auth");
  const [syncState, syncStateSet] = useState<SyncState>("idle");
  const [syncOffset, syncOffsetSet] = useState(0);
  const [busy, busySet] = useState(false);
  const [error, errorSet] = useState<string | null>(null);

  const [email, emailSet] = useState("demo@daycare.dev");
  const [otp, otpSet] = useState("111111");
  const [otpRequested, otpRequestedSet] = useState(false);
  const [sessionToken, sessionTokenSet] = useState<string | null>(null);

  const [organizations, organizationsSet] = useState<OrganizationCard[]>([]);
  const [activeOrganization, activeOrganizationSet] = useState<Organization | null>(null);
  const [activeUser, activeUserSet] = useState<User | null>(null);

  const [channels, channelsSet] = useState<Channel[]>([]);
  const [selectedChannelId, selectedChannelIdSet] = useState<Id | null>(null);

  const [rootMessagesByChannelId, rootMessagesByChannelIdSet] = useState<Record<Id, MessageView[]>>({});
  const [threadMessagesByRootId, threadMessagesByRootIdSet] = useState<Record<Id, MessageView[]>>({});
  const [activeThreadRootId, activeThreadRootIdSet] = useState<Id | null>(null);

  const [membersById, membersByIdSet] = useState<Record<Id, MessageView["author"]>>({});
  const [typingByChannelId, typingByChannelIdSet] = useState<Record<Id, TypingIndicator[]>>({});
  const [readStatesByChannelId, readStatesByChannelIdSet] = useState<Record<Id, ChannelReadState>>({});
  const [composerText, composerTextSet] = useState("");

  const contextRef = useRef<ContextState | null>(null);
  const syncEngineRef = useRef<SyncEngine | null>(null);
  const pendingMessagesRef = useRef<Map<string, PendingMessage>>(new Map());
  const lastTypingSignalAtRef = useRef(0);
  const selectedChannelIdRef = useRef<Id | null>(null);

  const stateReset = useCallback(() => {
    phaseSet("auth");
    syncStateSet("idle");
    syncOffsetSet(0);
    otpRequestedSet(false);
    sessionTokenSet(null);
    organizationsSet([]);
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
    pendingMessagesRef.current.clear();
    syncEngineRef.current?.stop();
    syncEngineRef.current = null;
  }, []);

  const orgCardsLoad = useCallback(
    async (token: string): Promise<OrganizationCard[]> => {
      const response: OrganizationAvailableResponse = await server.organizationAvailableList(token);
      const cards = response.items.map((item) => ({
        organization: item.organization,
        membership: item.membership,
        user: item.user
      }));
      organizationsSet(cards);
      return cards;
    },
    [server]
  );

  const channelReadRefresh = useCallback(
    async (token: string, orgId: Id, channelId: Id): Promise<void> => {
      const read = await server.readStateGet(token, orgId, channelId);
      readStatesByChannelIdSet((previous) => ({
        ...previous,
        [channelId]: read.readState
      }));
    },
    [server]
  );

  const channelRootMessagesLoad = useCallback(
    async (token: string, orgId: Id, channelId: Id): Promise<MessageView[]> => {
      const list = await server.messageList(token, orgId, channelId, { limit: 80 });
      rootMessagesByChannelIdSet((previous) => ({
        ...previous,
        [channelId]: list.items
      }));
      return list.items;
    },
    [server]
  );

  const threadMessagesLoad = useCallback(
    async (token: string, orgId: Id, channelId: Id, rootMessageId: Id): Promise<void> => {
      const list = await server.messageList(token, orgId, channelId, {
        limit: 80,
        threadRootMessageId: rootMessageId
      });
      threadMessagesByRootIdSet((previous) => ({
        ...previous,
        [rootMessageId]: list.items
      }));
    },
    [server]
  );

  const channelTypingLoad = useCallback(
    async (token: string, orgId: Id, channelId: Id): Promise<void> => {
      const typing = await server.typingList(token, orgId, channelId);
      typingByChannelIdSet((previous) => ({
        ...previous,
        [channelId]: typing.items
      }));
    },
    [server]
  );

  const channelReadMark = useCallback(
    async (token: string, orgId: Id, userId: Id, channelId: Id): Promise<void> => {
      const source = rootMessagesByChannelId[channelId] ?? [];
      const latest = source[source.length - 1];
      const lastReadAtMs = latest?.message.createdAt ?? Date.now();
      const lastReadMessageId = latest?.message.id;
      const read = await server.readStateSet(token, orgId, channelId, {
        lastReadAtMs,
        lastReadMessageId
      });
      if (read.readState.userId === userId) {
        readStatesByChannelIdSet((previous) => ({
          ...previous,
          [channelId]: read.readState
        }));
      }
    },
    [rootMessagesByChannelId, server]
  );

  const membersLoad = useCallback(
    async (token: string, orgId: Id): Promise<void> => {
      const members = await server.organizationMembers(token, orgId);
      const byId: Record<Id, MessageView["author"]> = {};
      for (const item of members.items) {
        byId[item.user.id] = item.user;
      }
      membersByIdSet(byId);
    },
    [server]
  );

  const channelAndReadBootstrap = useCallback(
    async (token: string, orgId: Id): Promise<Channel[]> => {
      const channelsResponse = await server.channelList(token, orgId);
      channelsSet(channelsResponse.items);
      const reads = await Promise.all(
        channelsResponse.items.map(async (channel) => {
          const read = await server.readStateGet(token, orgId, channel.id);
          return [channel.id, read.readState] as const;
        })
      );
      const readMap: Record<Id, ChannelReadState> = {};
      for (const [channelId, read] of reads) {
        readMap[channelId] = read;
      }
      readStatesByChannelIdSet(readMap);
      return channelsResponse.items;
    },
    [server]
  );

  const updateApply = useCallback(
    (update: UpdatesDiffItem): void => {
      const context = contextRef.current;
      if (!context) {
        return;
      }
      const { userId, orgId, token } = context;
      switch (update.event) {
        case "channel.created": {
          const data = update.data as { channel: Channel };
          channelsSet((previous) => {
            if (previous.some((channel) => channel.id === data.channel.id)) {
              return previous;
            }
            return [data.channel, ...previous].sort((a, b) => b.updatedAt - a.updatedAt);
          });
          break;
        }
        case "channel.updated": {
          const data = update.data as { channel: Channel };
          channelsSet((previous) => {
            const index = previous.findIndex((channel) => channel.id === data.channel.id);
            if (index < 0) {
              return previous;
            }
            const next = [...previous];
            next[index] = data.channel;
            return next.sort((a, b) => b.updatedAt - a.updatedAt);
          });
          break;
        }
        case "message.created": {
          const data = update.data as { message: MessageView };
          const incoming = data.message;
          const pendingId = incoming.message.clientMessageId;
          if (pendingId) {
            const pending = pendingMessagesRef.current.get(pendingId);
            if (pending) {
              pendingMessagesRef.current.delete(pendingId);
              if (pending.threadRootMessageId) {
                threadMessagesByRootIdSet((previous) => {
                  const source = previous[pending.threadRootMessageId as Id] ?? [];
                  const withoutOptimistic = source.filter((item) => item.message.id !== pending.optimisticMessageId);
                  return {
                    ...previous,
                    [pending.threadRootMessageId as Id]: messagesUpsert(withoutOptimistic, incoming)
                  };
                });
              } else {
                rootMessagesByChannelIdSet((previous) => {
                  const source = previous[pending.channelId] ?? [];
                  const withoutOptimistic = source.filter((item) => item.message.id !== pending.optimisticMessageId);
                  return {
                    ...previous,
                    [pending.channelId]: messagesUpsert(withoutOptimistic, incoming)
                  };
                });
              }
              break;
            }
          }

          if (incoming.message.threadRootMessageId) {
            const rootId = incoming.message.threadRootMessageId;
            if (rootId) {
              threadMessagesByRootIdSet((previous) => ({
                ...previous,
                [rootId]: messagesUpsert(previous[rootId] ?? [], incoming)
              }));
            }
          } else {
            rootMessagesByChannelIdSet((previous) => ({
              ...previous,
              [incoming.message.channelId]: messagesUpsert(previous[incoming.message.channelId] ?? [], incoming)
            }));
          }

          if (incoming.message.authorId !== userId) {
            if (incoming.message.channelId === selectedChannelIdRef.current) {
              void server
                .readStateSet(token, orgId, incoming.message.channelId, {
                  lastReadAtMs: incoming.message.createdAt,
                  lastReadMessageId: incoming.message.id
                })
                .then((read) => {
                  readStatesByChannelIdSet((previous) => ({
                    ...previous,
                    [incoming.message.channelId]: read.readState
                  }));
                });
            } else {
              void channelReadRefresh(token, orgId, incoming.message.channelId);
            }
          }
          break;
        }
        case "message.updated": {
          const data = update.data as { message: MessageView };
          const target = data.message;
          if (target.message.threadRootMessageId) {
            const rootId = target.message.threadRootMessageId;
            if (rootId) {
              threadMessagesByRootIdSet((previous) => ({
                ...previous,
                [rootId]: messagesUpsert(previous[rootId] ?? [], target)
              }));
            }
          } else {
            rootMessagesByChannelIdSet((previous) => ({
              ...previous,
              [target.message.channelId]: messagesUpsert(previous[target.message.channelId] ?? [], target)
            }));
          }
          break;
        }
        case "message.deleted": {
          const data = update.data as { messageId: Id; channelId: Id; deletedAt: number };
          rootMessagesByChannelIdSet((previous) => ({
            ...previous,
            [data.channelId]: messagePatch(previous[data.channelId] ?? [], data.messageId, (message) => ({
              ...message,
              message: {
                ...message.message,
                text: "[deleted]",
                deletedAt: data.deletedAt,
                updatedAt: data.deletedAt
              }
            }))
          }));
          threadMessagesByRootIdSet((previous) => {
            const next = { ...previous };
            for (const [rootId, items] of Object.entries(previous)) {
              next[rootId] = messagePatch(items, data.messageId, (message) => ({
                ...message,
                message: {
                  ...message.message,
                  text: "[deleted]",
                  deletedAt: data.deletedAt,
                  updatedAt: data.deletedAt
                }
              }));
            }
            return next;
          });
          break;
        }
        case "thread.updated": {
          const data = update.data as {
            channelId: Id;
            threadRootMessageId: Id;
            threadReplyCount: number;
            threadLastReplyAt: number | null;
          };
          rootMessagesByChannelIdSet((previous) => ({
            ...previous,
            [data.channelId]: messagePatch(previous[data.channelId] ?? [], data.threadRootMessageId, (message) => ({
              ...message,
              message: {
                ...message.message,
                threadReplyCount: data.threadReplyCount,
                threadLastReplyAt: data.threadLastReplyAt,
                updatedAt: Date.now()
              }
            }))
          }));
          break;
        }
        case "reaction.updated": {
          const data = update.data as {
            channelId: Id;
            messageId: Id;
            reactions: MessageView["message"]["reactions"];
          };
          rootMessagesByChannelIdSet((previous) => ({
            ...previous,
            [data.channelId]: messagePatch(previous[data.channelId] ?? [], data.messageId, (message) => ({
              ...message,
              message: {
                ...message.message,
                reactions: data.reactions
              }
            }))
          }));
          threadMessagesByRootIdSet((previous) => {
            const next = { ...previous };
            for (const [rootId, items] of Object.entries(previous)) {
              next[rootId] = messagePatch(items, data.messageId, (message) => ({
                ...message,
                message: {
                  ...message.message,
                  reactions: data.reactions
                }
              }));
            }
            return next;
          });
          break;
        }
        case "typing.updated": {
          const data = update.data as { channelId: Id; threadRootMessageId: Id | null; items: TypingIndicator[] };
          if (data.threadRootMessageId === null) {
            typingByChannelIdSet((previous) => ({
              ...previous,
              [data.channelId]: data.items.filter((item) => item.userId !== userId)
            }));
          }
          break;
        }
        case "read.updated": {
          const data = update.data as { channelId: Id; userId: Id; readState: ChannelReadState };
          if (data.userId === userId) {
            readStatesByChannelIdSet((previous) => ({
              ...previous,
              [data.channelId]: data.readState
            }));
          }
          break;
        }
        default:
          break;
      }
    },
    [channelReadRefresh, server]
  );

  const workspaceReload = useCallback(async (): Promise<void> => {
    const context = contextRef.current;
    if (!context) {
      return;
    }
    const { token, orgId, userId } = context;
    const freshChannels = await channelAndReadBootstrap(token, orgId);
    const selected = selectedChannelId && freshChannels.some((channel) => channel.id === selectedChannelId)
      ? selectedChannelId
      : freshChannels[0]?.id ?? null;
    selectedChannelIdSet(selected);
    if (selected) {
      await channelRootMessagesLoad(token, orgId, selected);
      await channelTypingLoad(token, orgId, selected);
      await channelReadMark(token, orgId, userId, selected);
    }
  }, [channelAndReadBootstrap, channelReadMark, channelRootMessagesLoad, channelTypingLoad, selectedChannelId]);

  const workspaceStart = useCallback(
    async (token: string, orgId: Id, user: User): Promise<void> => {
      busySet(true);
      errorSet(null);
      syncStateSet("syncing");
      try {
        const org = await server.organizationGet(token, orgId);
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
        pendingMessagesRef.current.clear();

        if (selected) {
          await channelRootMessagesLoad(token, orgId, selected);
          await channelTypingLoad(token, orgId, selected);
          await channelReadMark(token, orgId, user.id, selected);
        }

        syncEngineRef.current?.stop();
        const engine = syncEngineCreate({
          server,
          token,
          orgId,
          onUpdate: updateApply,
          onOffset: syncOffsetSet,
          onResetRequired: async () => {
            await workspaceReload();
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
    [
      channelAndReadBootstrap,
      channelReadMark,
      channelRootMessagesLoad,
      channelTypingLoad,
      membersLoad,
      server,
      updateApply,
      workspaceReload
    ]
  );

  const requestOtp = useCallback(async (): Promise<void> => {
    busySet(true);
    errorSet(null);
    try {
      await server.authEmailRequestOtp({ email });
      otpRequestedSet(true);
    } catch (requestError) {
      errorSet(errorToMessage(requestError));
    } finally {
      busySet(false);
    }
  }, [email, server]);

  const verifyOtp = useCallback(async (): Promise<void> => {
    busySet(true);
    errorSet(null);
    try {
      const result = await server.authEmailVerifyOtp({ email, otp });
      sessionTokenSet(result.session.token);
      await orgCardsLoad(result.session.token);
      phaseSet("orgs");
    } catch (verifyError) {
      errorSet(errorToMessage(verifyError));
    } finally {
      busySet(false);
    }
  }, [email, otp, orgCardsLoad, server]);

  const organizationOpen = useCallback(
    async (orgId: Id): Promise<void> => {
      const token = sessionToken;
      if (!token) {
        return;
      }
      busySet(true);
      errorSet(null);
      try {
        const card = organizations.find((item) => item.organization.id === orgId);
        if (!card) {
          throw new Error("Organization not found in picker");
        }
        let user = card.user;
        if (!card.membership || !user) {
          const join = await server.organizationJoin(token, orgId, {
            firstName: email.split("@")[0] || "member",
            username: email.split("@")[0] || "member"
          });
          user = join.user;
          await orgCardsLoad(token);
        }
        await workspaceStart(token, orgId, user);
      } catch (openError) {
        errorSet(errorToMessage(openError));
      } finally {
        busySet(false);
      }
    },
    [email, orgCardsLoad, organizations, server, sessionToken, workspaceStart]
  );

  const organizationCreate = useCallback(
    async (name: string): Promise<void> => {
      const token = sessionToken;
      if (!token) {
        return;
      }
      busySet(true);
      errorSet(null);
      try {
        const created = await server.organizationCreate(token, { name });
        await orgCardsLoad(token);
        await workspaceStart(token, created.organization.id, created.user);
      } catch (createError) {
        errorSet(errorToMessage(createError));
      } finally {
        busySet(false);
      }
    },
    [orgCardsLoad, server, sessionToken, workspaceStart]
  );

  const channelSelect = useCallback(
    async (channelId: Id): Promise<void> => {
      const context = contextRef.current;
      if (!context) {
        return;
      }
      const { token, orgId, userId } = context;
      selectedChannelIdSet(channelId);
      activeThreadRootIdSet(null);
      composerTextSet("");
      if (!rootMessagesByChannelId[channelId]) {
        await channelRootMessagesLoad(token, orgId, channelId);
      }
      await channelTypingLoad(token, orgId, channelId);
      await channelReadMark(token, orgId, userId, channelId);
    },
    [channelReadMark, channelRootMessagesLoad, channelTypingLoad, rootMessagesByChannelId]
  );

  const channelCreate = useCallback(
    async (name: string): Promise<void> => {
      const context = contextRef.current;
      if (!context) {
        return;
      }
      const { token, orgId } = context;
      busySet(true);
      errorSet(null);
      try {
        const created = await server.channelCreate(token, orgId, {
          name
        });
        channelsSet((previous) => [created.channel, ...previous].sort((a, b) => b.updatedAt - a.updatedAt));
        await channelSelect(created.channel.id);
      } catch (createError) {
        errorSet(errorToMessage(createError));
      } finally {
        busySet(false);
      }
    },
    [channelSelect, server]
  );

  const typingSignal = useCallback(
    async (isTyping: boolean): Promise<void> => {
      const context = contextRef.current;
      if (!context || !selectedChannelId) {
        return;
      }
      const { token, orgId } = context;
      const now = Date.now();
      if (isTyping && now - lastTypingSignalAtRef.current < 1500) {
        return;
      }
      lastTypingSignalAtRef.current = now;
      try {
        await server.typingUpsert(token, orgId, selectedChannelId, { isTyping, ttlMs: 5000 });
      } catch {
        // Keep UI resilient if typing ping fails.
      }
    },
    [selectedChannelId, server]
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

    const clientMessageId = `client_${Math.random().toString(36).slice(2, 10)}`;
    const optimisticMessageId = `optimistic_${clientMessageId}`;
    const createdAt = Date.now();
    const optimistic: MessageView = {
      author: userPreview(user),
      message: {
        id: optimisticMessageId,
        organizationId: context.orgId,
        channelId,
        authorId: user.id,
        text,
        mentionUserIds: [],
        threadRootMessageId: activeThreadRootId,
        threadReplyCount: 0,
        threadLastReplyAt: null,
        attachments: [],
        reactions: [],
        createdAt,
        updatedAt: createdAt,
        deletedAt: null,
        clientMessageId
      }
    };

    pendingMessagesRef.current.set(clientMessageId, {
      channelId,
      optimisticMessageId,
      threadRootMessageId: activeThreadRootId
    });

    if (activeThreadRootId) {
      threadMessagesByRootIdSet((previous) => ({
        ...previous,
        [activeThreadRootId]: messagesUpsert(previous[activeThreadRootId] ?? [], optimistic)
      }));
    } else {
      rootMessagesByChannelIdSet((previous) => ({
        ...previous,
        [channelId]: messagesUpsert(previous[channelId] ?? [], optimistic)
      }));
    }

    composerTextSet("");
    await typingSignal(false);

    try {
      const sent = await server.messageSend(context.token, context.orgId, {
        channelId,
        text,
        threadRootMessageId: activeThreadRootId ?? undefined,
        clientMessageId
      });
      updateApply({
        seqno: Number.MAX_SAFE_INTEGER - Math.floor(Math.random() * 1000),
        event: "message.created",
        data: { message: sent.message },
        at: Date.now()
      });
      await channelReadMark(context.token, context.orgId, context.userId, channelId);
    } catch (sendError) {
      pendingMessagesRef.current.delete(clientMessageId);
      if (activeThreadRootId) {
        threadMessagesByRootIdSet((previous) => ({
          ...previous,
          [activeThreadRootId]: (previous[activeThreadRootId] ?? []).filter(
            (message) => message.message.id !== optimisticMessageId
          )
        }));
      } else {
        rootMessagesByChannelIdSet((previous) => ({
          ...previous,
          [channelId]: (previous[channelId] ?? []).filter((message) => message.message.id !== optimisticMessageId)
        }));
      }
      errorSet(errorToMessage(sendError));
    }
  }, [activeThreadRootId, activeUser, channelReadMark, composerText, selectedChannelId, server, typingSignal, updateApply]);

  const threadOpen = useCallback(
    async (rootMessageId: Id): Promise<void> => {
      const context = contextRef.current;
      if (!context || !selectedChannelId) {
        return;
      }
      activeThreadRootIdSet(rootMessageId);
      if (!threadMessagesByRootId[rootMessageId]) {
        await threadMessagesLoad(context.token, context.orgId, selectedChannelId, rootMessageId);
      }
    },
    [selectedChannelId, threadMessagesByRootId, threadMessagesLoad]
  );

  const threadClose = useCallback((): void => {
    activeThreadRootIdSet(null);
  }, []);

  const reactionToggle = useCallback(
    async (messageId: Id, shortcode: string): Promise<void> => {
      const context = contextRef.current;
      const userId = activeUser?.id;
      if (!context || !selectedChannelId || !userId) {
        return;
      }
      const sourceRoot = rootMessagesByChannelId[selectedChannelId] ?? [];
      const sourceThread = activeThreadRootId ? threadMessagesByRootId[activeThreadRootId] ?? [] : [];
      const found = [...sourceRoot, ...sourceThread].find((item) => item.message.id === messageId);
      if (!found) {
        return;
      }
      const reaction = found.message.reactions.find((item) => item.shortcode === shortcode);
      const alreadyReacted = reaction?.userIds.includes(userId) ?? false;
      const response = alreadyReacted
        ? await server.messageReactionRemove(context.token, context.orgId, messageId, { shortcode })
        : await server.messageReactionAdd(context.token, context.orgId, messageId, { shortcode });

      updateApply({
        seqno: Number.MAX_SAFE_INTEGER - Math.floor(Math.random() * 1000),
        event: "reaction.updated",
        data: {
          channelId: selectedChannelId,
          messageId,
          reactions: response.reactions
        },
        at: Date.now()
      });
    },
    [activeThreadRootId, activeUser?.id, rootMessagesByChannelId, selectedChannelId, server, threadMessagesByRootId, updateApply]
  );

  const holeSimulate = useCallback(async (): Promise<void> => {
    const context = contextRef.current;
    if (!context) {
      return;
    }
    await server.updatesHoleSimulate(context.orgId);
  }, [server]);

  const logout = useCallback(async (): Promise<void> => {
    if (sessionToken) {
      try {
        await server.authLogout(sessionToken);
      } catch {
        // Ignore logout errors in mock mode.
      }
    }
    stateReset();
  }, [server, sessionToken, stateReset]);

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
    otp,
    otpRequested,
    sessionToken,
    organizations,
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
    otpSet,
    composerTextSet: composerTextSetWrapped,
    requestOtp,
    verifyOtp,
    organizationOpen,
    organizationCreate,
    channelSelect,
    channelCreate,
    messageSend,
    threadOpen,
    threadClose,
    reactionToggle,
    holeSimulate,
    logout
  };
}
