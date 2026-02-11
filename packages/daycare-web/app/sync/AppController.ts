import { syncEngine, type SyncEngine } from "@slopus/sync";
import type { StoreApi } from "zustand";
import type { ApiClient } from "../daycare/api/apiClientCreate";
import type { UpdateEnvelope } from "../daycare/types";
import { schema, type Schema } from "./schema";
import { storageStoreCreate, type StorageStore } from "./storageStoreCreate";
import { UpdateSequencer } from "./UpdateSequencer";
import { mapEventToRebase } from "./eventMappers";
import { mutationApply } from "./mutationApply";
import { connectionStatusSet } from "../stores/connectionStoreContext";
import { toastAdd } from "../stores/toastStoreContext";
import { sessionClear } from "../lib/sessionStore";

const STORAGE_KEY = "daycare:engine";
const HEARTBEAT_INTERVAL_MS = 60_000;
const SSE_RECONNECT_BASE_MS = 1_000;
const SSE_RECONNECT_MAX_MS = 30_000;

export class AppController {
  readonly engine: SyncEngine<Schema>;
  readonly storage: StoreApi<StorageStore>;
  readonly api: ApiClient;
  readonly token: string;
  readonly orgId: string;

  private sequencer: UpdateSequencer;
  private sseSubscription: { close: () => void } | null = null;
  private processingMutations = false;
  private destroyed = false;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private sseReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private sseReconnectAttempts = 0;

  private constructor(
    engine: SyncEngine<Schema>,
    storage: StoreApi<StorageStore>,
    api: ApiClient,
    token: string,
    orgId: string,
  ) {
    this.engine = engine;
    this.storage = storage;
    this.api = api;
    this.token = token;
    this.orgId = orgId;

    this.sequencer = new UpdateSequencer({
      onBatch: (updates) => this.handleBatch(updates),
      onHole: () => this.handleHole(),
    }, engine.state.context.seqno);
  }

  static async create(api: ApiClient, token: string): Promise<AppController> {
    const profile = await api.meGet(token);
    const org = profile.organizations[0];
    if (!org) {
      throw new Error("No organizations available");
    }

    // Fetch user profile for display info (username, name, avatar)
    const { profile: userProfile } = await api.profileGet(token, org.id);

    const contextData = {
      userId: profile.account.id,
      orgId: org.id,
      orgSlug: org.slug,
      orgName: org.name,
      username: userProfile.username,
      firstName: userProfile.firstName,
      lastName: userProfile.lastName,
      avatarUrl: userProfile.avatarUrl,
    };

    let engine: SyncEngine<Schema>;

    // Try restoring from localStorage
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        engine = syncEngine(schema, { from: "restore", data: saved });
        // Verify the restored engine matches current user/org
        if (
          engine.state.context.userId !== profile.account.id ||
          engine.state.context.orgId !== org.id
        ) {
          // User/org mismatch — start fresh
          engine = syncEngine(schema, {
            from: "new",
            objects: { context: contextData },
          });
        } else {
          // Update display info in case it changed since last save
          engine.rebase(
            { context: { username: contextData.username, firstName: contextData.firstName, lastName: contextData.lastName, avatarUrl: contextData.avatarUrl } },
          );
        }
      } catch {
        // Corrupt data — start fresh
        engine = syncEngine(schema, {
          from: "new",
          objects: { context: contextData },
        });
      }
    } else {
      engine = syncEngine(schema, {
        from: "new",
        objects: { context: contextData },
      });
    }

    const controller = new AppController(
      engine,
      null as unknown as StoreApi<StorageStore>,
      api,
      token,
      org.id,
    );

    // Create storage store with onMutate wired to pending mutation processing
    const storage = storageStoreCreate(engine, () => {
      controller.invalidateSync();
    });

    // Assign storage (circumvent readonly for construction)
    (controller as { storage: StoreApi<StorageStore> }).storage = storage;

    return controller;
  }

  static createWithOrg(
    api: ApiClient,
    token: string,
    userId: string,
    orgId: string,
    orgSlug: string,
    orgName: string,
    userDisplay?: { username: string; firstName: string; lastName: string | null; avatarUrl: string | null },
  ): AppController {
    const contextData = {
      userId,
      orgId,
      orgSlug,
      orgName,
      username: userDisplay?.username ?? "",
      firstName: userDisplay?.firstName ?? "",
      lastName: userDisplay?.lastName ?? null,
      avatarUrl: userDisplay?.avatarUrl ?? null,
    };

    let engine: SyncEngine<Schema>;

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        engine = syncEngine(schema, { from: "restore", data: saved });
        if (
          engine.state.context.userId !== userId ||
          engine.state.context.orgId !== orgId
        ) {
          engine = syncEngine(schema, {
            from: "new",
            objects: { context: contextData },
          });
        }
      } catch {
        engine = syncEngine(schema, {
          from: "new",
          objects: { context: contextData },
        });
      }
    } else {
      engine = syncEngine(schema, {
        from: "new",
        objects: { context: contextData },
      });
    }

    const controller = new AppController(
      engine,
      null as unknown as StoreApi<StorageStore>,
      api,
      token,
      orgId,
    );

    const storage = storageStoreCreate(engine, () => {
      controller.invalidateSync();
    });
    (controller as { storage: StoreApi<StorageStore> }).storage = storage;

    return controller;
  }

  startSSE(): void {
    if (this.sseSubscription) return;

    this.sseSubscription = this.api.updatesStreamSubscribe(
      this.token,
      this.orgId,
      (update: UpdateEnvelope) => {
        this.sequencer.push(update);
      },
      () => {
        // SSE stream is ready — catch up from current seqno
        if (this.sseReconnectAttempts > 0) {
          toastAdd("Reconnected", "success");
        }
        this.sseReconnectAttempts = 0;
        connectionStatusSet("connected");
        this.catchUp();
      },
      () => {
        // SSE disconnected — schedule reconnect
        this.handleSSEDisconnect();
      },
    );
  }

  private scheduleSSEReconnect(): void {
    if (this.destroyed || this.sseReconnectTimer) return;

    this.sseReconnectAttempts++;
    const delay = Math.min(
      SSE_RECONNECT_BASE_MS * Math.pow(2, this.sseReconnectAttempts - 1),
      SSE_RECONNECT_MAX_MS,
    );

    connectionStatusSet("reconnecting");

    this.sseReconnectTimer = setTimeout(() => {
      this.sseReconnectTimer = null;
      if (this.destroyed) return;

      // Close old subscription
      this.sseSubscription?.close();
      this.sseSubscription = null;

      // Restart SSE
      this.startSSE();
    }, delay);
  }

  /** Called externally (from sseSubscribe onError) or internally when SSE stream ends. */
  handleSSEDisconnect(): void {
    if (this.destroyed) return;
    this.sseSubscription?.close();
    this.sseSubscription = null;
    this.scheduleSSEReconnect();
  }

  private handleBatch(updates: UpdateEnvelope[]): void {
    let needChannelSync = false;
    const channelIdsToResync = new Set<string>();
    const currentUserId = this.engine.state.context.userId;

    for (const update of updates) {
      const result = mapEventToRebase(update);
      if (result.rebase) {
        this.engine.rebase(result.rebase);
      }
      if (result.resyncChannels) needChannelSync = true;
      if (result.resyncMessages) channelIdsToResync.add(result.resyncMessages);

      // Current user was deactivated from the org — redirect to org picker
      if (result.deactivatedUserId && result.deactivatedUserId === currentUserId) {
        toastAdd("You've been removed from this organization", "warning");
        this.destroy();
        sessionClear();
        window.location.href = "/orgs";
        return;
      }
    }

    // Track latest seqno
    const lastSeqno = updates[updates.length - 1].seqno;
    this.engine.rebase(
      { context: { seqno: lastSeqno } },
      { allowLocalFields: true, allowServerFields: false },
    );

    this.storage.getState().updateObjects();
    this.persist();

    // Trigger resyncs for events that carried only IDs
    if (needChannelSync) void this.syncChannels();
    for (const channelId of channelIdsToResync) {
      void this.syncMessages(channelId);
    }
  }

  private handleHole(): void {
    // Missing seqno detected — do a full restart
    this.restartSession();
  }

  private async catchUp(): Promise<void> {
    if (this.destroyed) return;

    const currentSeqno = this.engine.state.context.seqno;
    if (currentSeqno === 0) {
      // Fresh session — do a full sync instead of diff
      await this.syncChannels();
      await this.syncDirects();
      return;
    }

    try {
      const result = await this.api.updatesDiff(this.token, this.orgId, {
        offset: currentSeqno,
      });

      if (result.resetRequired) {
        await this.restartSession();
        return;
      }

      let needChannelSync = false;
      const channelIdsToResync = new Set<string>();
      const currentUserId = this.engine.state.context.userId;

      for (const update of result.updates) {
        const mapped = mapEventToRebase(update);
        if (mapped.rebase) {
          this.engine.rebase(mapped.rebase);
        }
        if (mapped.resyncChannels) needChannelSync = true;
        if (mapped.resyncMessages) channelIdsToResync.add(mapped.resyncMessages);

        // Current user was deactivated from the org — redirect to org picker
        if (mapped.deactivatedUserId && mapped.deactivatedUserId === currentUserId) {
          toastAdd("You've been removed from this organization", "warning");
          this.destroy();
          sessionClear();
          window.location.href = "/orgs";
          return;
        }
      }

      if (result.updates.length > 0) {
        const lastSeqno = result.updates[result.updates.length - 1].seqno;
        this.engine.rebase(
          { context: { seqno: lastSeqno } },
          { allowLocalFields: true, allowServerFields: false },
        );
        this.sequencer.reset(lastSeqno);
      }

      this.storage.getState().updateObjects();
      this.persist();

      // Trigger resyncs for events that carried only IDs
      if (needChannelSync) await this.syncChannels();
      for (const channelId of channelIdsToResync) {
        await this.syncMessages(channelId);
      }
    } catch {
      // Diff failed — try full restart
      await this.restartSession();
    }
  }

  private async restartSession(): Promise<void> {
    if (this.destroyed) return;
    this.sequencer.reset(0);
    await this.syncChannels();
    await this.syncDirects();
  }

  async syncChannels(): Promise<void> {
    if (this.destroyed) return;

    const result = await this.api.channelList(this.token, this.orgId);
    const channels = result.channels.map((ch) => ({
      id: ch.id,
      organizationId: ch.organizationId,
      name: ch.name,
      topic: ch.topic,
      visibility: ch.visibility as "public" | "private",
      createdAt: ch.createdAt,
      updatedAt: ch.updatedAt,
    }));

    this.engine.rebase({ channel: channels });
    this.storage.getState().updateObjects();
    this.persist();
  }

  async syncDirects(): Promise<void> {
    if (this.destroyed) return;

    try {
      const result = await this.api.directList(this.token, this.orgId);
      const directs = result.directs.map((d) => ({
        id: d.channel.id,
        organizationId: d.channel.organizationId,
        createdAt: d.channel.createdAt,
        updatedAt: d.channel.updatedAt,
        otherUser: {
          id: d.otherUser.id,
          kind: d.otherUser.kind,
          username: d.otherUser.username,
          firstName: d.otherUser.firstName,
          lastName: d.otherUser.lastName,
          avatarUrl: d.otherUser.avatarUrl,
        },
      }));

      this.engine.rebase({ direct: directs });
      this.storage.getState().updateObjects();
      this.persist();
    } catch {
      // DM sync failure is non-critical
    }
  }

  async syncMessages(channelId: string): Promise<void> {
    if (this.destroyed) return;

    const result = await this.api.messageList(
      this.token,
      this.orgId,
      channelId,
    );
    const messages = this.mapMessages(result.messages);

    this.engine.rebase({ message: messages });
    this.storage.getState().updateObjects();
    this.persist();
  }

  /**
   * Fetch a page of older messages before the given cursor.
   * Returns the count of messages fetched so callers can determine if more exist.
   */
  async syncMessagesPage(
    channelId: string,
    options: { before: string; limit: number },
  ): Promise<{ fetchedCount: number }> {
    if (this.destroyed) return { fetchedCount: 0 };

    const result = await this.api.messageList(
      this.token,
      this.orgId,
      channelId,
      { before: options.before, limit: options.limit },
    );
    const messages = this.mapMessages(result.messages);

    this.engine.rebase({ message: messages });
    this.storage.getState().updateObjects();
    this.persist();

    return { fetchedCount: result.messages.length };
  }

  private mapMessages(raw: Array<{
    id: string; chatId: string; senderUserId: string; threadId: string | null;
    text: string; createdAt: number; editedAt: number | null; deletedAt: number | null;
    threadReplyCount: number; threadLastReplyAt: number | null;
    sender: { id: string; kind: string; username: string; firstName: string; lastName: string | null; avatarUrl: string | null };
    attachments: Array<{ id: string; kind: string; url: string; mimeType: string | null; fileName: string | null; sizeBytes: number | null; sortOrder: number }>;
    reactions: Array<{ id: string; userId: string; shortcode: string; createdAt: number }>;
  }>) {
    return raw.map((msg) => ({
      id: msg.id,
      chatId: msg.chatId,
      senderUserId: msg.senderUserId,
      threadId: msg.threadId,
      text: msg.text,
      createdAt: msg.createdAt,
      editedAt: msg.editedAt,
      deletedAt: msg.deletedAt,
      threadReplyCount: msg.threadReplyCount,
      threadLastReplyAt: msg.threadLastReplyAt,
      sender: {
        id: msg.sender.id,
        kind: msg.sender.kind,
        username: msg.sender.username,
        firstName: msg.sender.firstName,
        lastName: msg.sender.lastName,
        avatarUrl: msg.sender.avatarUrl,
      },
      attachments: msg.attachments,
      reactions: msg.reactions,
    }));
  }

  async syncThreadMessages(channelId: string, threadId: string): Promise<void> {
    if (this.destroyed) return;

    const result = await this.api.messageList(
      this.token,
      this.orgId,
      channelId,
      { threadId },
    );
    const messages = this.mapMessages(result.messages);

    this.engine.rebase({ message: messages });
    this.storage.getState().updateObjects();
    this.persist();
  }

  private invalidateSync(): void {
    if (this.destroyed) return;
    void this.processPendingMutations();
  }

  private async processPendingMutations(): Promise<void> {
    if (this.processingMutations || this.destroyed) return;
    this.processingMutations = true;

    try {
      while (this.engine.pendingMutations.length > 0) {
        if (this.destroyed) break;
        const mutation = this.engine.pendingMutations[0];

        try {
          // Build context for mutations that need engine state (e.g. reactionToggle)
          const mutationContext = {
            userId: this.engine.state.context.userId,
            messageReactions: Object.fromEntries(
              Object.entries(this.engine.state.message).map(([id, msg]) => [
                id,
                msg.reactions.map((r) => ({ userId: r.userId, shortcode: r.shortcode })),
              ]),
            ),
          };

          const result = await mutationApply(
            this.api,
            this.token,
            this.orgId,
            mutation,
            mutationContext,
          );

          if (Object.keys(result.snapshot).length > 0) {
            this.engine.rebase(result.snapshot);
          }
          this.engine.commit(mutation.id);
          this.storage.getState().updateObjects();
          this.persist();
        } catch (error) {
          // Mutation failed — remove it and let the UI reflect rollback
          console.error(
            `Mutation ${mutation.name} failed:`,
            error,
          );
          this.engine.commit(mutation.id);
          this.storage.getState().updateObjects();
          toastAdd(
            `Failed to send: ${error instanceof Error ? error.message : "unknown error"}`,
            "error",
          );
          break;
        }
      }
    } finally {
      this.processingMutations = false;
    }
  }

  startPresence(): void {
    if (this.heartbeatTimer) return;

    // Set initial presence to online
    this.api.presenceSet(this.token, this.orgId, { status: "online" }).catch(() => {});

    // Heartbeat every 60 seconds
    this.heartbeatTimer = setInterval(() => {
      if (this.destroyed) return;
      this.api.presenceHeartbeat(this.token, this.orgId).catch(() => {});
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopPresence(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  async syncPresence(userIds: string[]): Promise<void> {
    if (this.destroyed || userIds.length === 0) return;

    try {
      const result = await this.api.presenceGet(this.token, this.orgId, userIds);
      const presenceItems = result.presence.map((p) => ({
        id: p.userId,
        userId: p.userId,
        status: p.status,
        lastSeenAt: Date.now(),
      }));

      if (presenceItems.length > 0) {
        this.engine.rebase({ presence: presenceItems });
        this.storage.getState().updateObjects();
      }
    } catch {
      // Presence sync failure is non-critical
    }
  }

  persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, this.engine.persist());
    } catch {
      // localStorage might be full or unavailable
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.stopPresence();
    this.sseSubscription?.close();
    this.sseSubscription = null;
    if (this.sseReconnectTimer) {
      clearTimeout(this.sseReconnectTimer);
      this.sseReconnectTimer = null;
    }
    this.sequencer.destroy();
  }
}
