import type {
  Account,
  Channel,
  ChannelMember,
  ChannelSearchResult,
  Direct,
  Message,
  MessageListResponse,
  MessageSearchResult,
  Organization,
  ReadState,
  Session,
  TypingState,
  UpdateEnvelope,
  UpdatesDiffResult,
  User
} from "../types";
import { apiRequest } from "./apiRequest";
import { sseSubscribe } from "./sseSubscribe";

export type FileAsset = {
  id: string;
  organizationId: string;
  contentHash: string;
  mimeType: string;
  sizeBytes: number;
  status: "pending" | "committed" | "deleted";
  createdAt: number;
  expiresAt: number | null;
  committedAt: number | null;
};

export type UploadInitResult = {
  file: FileAsset;
  upload: {
    method: string;
    contentType: string;
    url: string;
  };
};

export type ApiClient = {
  authLogin: (email: string) => Promise<{ token: string; account: Account; session: Session }>;
  authRequestOtp: (email: string) => Promise<{ sent: boolean; expiresInSeconds: number }>;
  authVerifyOtp: (email: string, code: string) => Promise<{ token: string; account: Account; session: Session }>;
  authLogout: (token: string) => Promise<{ revoked: boolean }>;
  meGet: (token: string) => Promise<{ account: Account; organizations: Organization[] }>;
  organizationAvailableList: (token: string) => Promise<{ organizations: Organization[] }>;
  organizationCreate: (
    token: string,
    input: { slug: string; name: string; firstName: string; username: string }
  ) => Promise<{ organization: Organization }>;
  organizationJoin: (token: string, orgId: string, input: { firstName: string; username: string }) => Promise<{
    joined: boolean;
    user: User;
  }>;
  organizationGet: (token: string, orgId: string) => Promise<{ organization: Organization }>;
  organizationMembers: (token: string, orgId: string) => Promise<{ members: User[] }>;
  profileGet: (token: string, orgId: string) => Promise<{ profile: User }>;
  profilePatch: (token: string, orgId: string, input: Partial<User>) => Promise<{ profile: User }>;
  channelList: (token: string, orgId: string) => Promise<{ channels: Channel[] }>;
  channelCreate: (
    token: string,
    orgId: string,
    input: { name: string; topic?: string | null; visibility?: "public" | "private" }
  ) => Promise<{ channel: Channel }>;
  channelJoin: (token: string, orgId: string, channelId: string) => Promise<{ joined: boolean; membership: ChannelMember }>;
  channelLeave: (token: string, orgId: string, channelId: string) => Promise<{ left: boolean; membership: ChannelMember }>;
  channelMembers: (token: string, orgId: string, channelId: string) => Promise<{ members: Array<ChannelMember & { user: User }> }>;
  messageList: (
    token: string,
    orgId: string,
    channelId: string,
    query?: { limit?: number; before?: string; after?: string; around?: string; threadId?: string | null }
  ) => Promise<MessageListResponse>;
  messageSend: (
    token: string,
    orgId: string,
    input: {
      channelId: string;
      text: string;
      threadId?: string | null;
      attachments?: Array<{
        kind: string;
        url: string;
        mimeType?: string | null;
        fileName?: string | null;
        sizeBytes?: number | null;
      }>;
    }
  ) => Promise<{ message: Message }>;
  messageEdit: (token: string, orgId: string, messageId: string, input: { text: string }) => Promise<{ message: Message }>;
  messageDelete: (token: string, orgId: string, messageId: string) => Promise<{ deleted: boolean; messageId: string }>;
  messageReactionAdd: (token: string, orgId: string, messageId: string, input: { shortcode: string }) => Promise<{ added: boolean }>;
  messageReactionRemove: (
    token: string,
    orgId: string,
    messageId: string,
    input: { shortcode: string }
  ) => Promise<{ removed: boolean }>;
  typingUpsert: (token: string, orgId: string, channelId: string, input: { threadRootMessageId?: string | null }) => Promise<{
    ok: true;
    expiresAt: number;
  }>;
  typingList: (token: string, orgId: string, channelId: string) => Promise<{ typing: TypingState[] }>;
  readStateSet: (token: string, orgId: string, channelId: string) => Promise<{ chatId: string; lastReadAt: number }>;
  readStateGet: (token: string, orgId: string, channelId: string) => Promise<ReadState>;
  directList: (token: string, orgId: string) => Promise<{ directs: Direct[] }>;
  directCreate: (token: string, orgId: string, input: { userId: string }) => Promise<{ channel: Channel }>;
  fileUploadInit: (
    token: string,
    orgId: string,
    input: { filename: string; mimeType: string; sizeBytes: number; contentHash: string }
  ) => Promise<UploadInitResult>;
  fileUpload: (token: string, orgId: string, fileId: string, input: { payloadBase64: string }) => Promise<{ file: FileAsset }>;
  fileGet: (token: string, orgId: string, fileId: string) => Promise<Response>;
  searchMessages: (
    token: string,
    orgId: string,
    query: { q: string; channelId?: string; before?: number; limit?: number }
  ) => Promise<{ messages: MessageSearchResult[] }>;
  searchChannels: (
    token: string,
    orgId: string,
    query: { q: string; limit?: number }
  ) => Promise<{ channels: ChannelSearchResult[] }>;
  updatesDiff: (token: string, orgId: string, input: { offset: number; limit?: number }) => Promise<UpdatesDiffResult>;
  updatesStreamSubscribe: (
    token: string,
    orgId: string,
    onUpdate: (update: UpdateEnvelope) => void,
    onReady?: () => void
  ) => { close: () => void };
};

const DEFAULT_BASE_URL = "http://localhost:3005";

export function apiClientCreate(baseUrl: string = DEFAULT_BASE_URL): ApiClient {
  const request = <T>(path: string, options: { token?: string | null; method?: "GET" | "POST" | "PATCH"; body?: unknown } = {}) =>
    apiRequest<T>({
      baseUrl,
      path,
      method: options.method,
      token: options.token,
      body: options.body
    });

  return {
    authLogin: (email) => request("/api/auth/login", { method: "POST", body: { email } }),
    authRequestOtp: (email) => request("/api/auth/email/request-otp", { method: "POST", body: { email } }),
    authVerifyOtp: (email, code) => request("/api/auth/email/verify-otp", { method: "POST", body: { email, code } }),
    authLogout: (token) => request("/api/auth/logout", { method: "POST", token }),
    meGet: (token) => request("/api/me", { token }),
    organizationAvailableList: (token) => request("/api/org/available", { token }),
    organizationCreate: (token, input) => request("/api/org/create", { method: "POST", token, body: input }),
    organizationJoin: (token, orgId, input) => request(`/api/org/${orgId}/join`, { method: "POST", token, body: input }),
    organizationGet: (token, orgId) => request(`/api/org/${orgId}`, { token }),
    organizationMembers: (token, orgId) => request(`/api/org/${orgId}/members`, { token }),
    profileGet: (token, orgId) => request(`/api/org/${orgId}/profile`, { token }),
    profilePatch: (token, orgId, input) => request(`/api/org/${orgId}/profile`, { method: "PATCH", token, body: input }),
    channelList: (token, orgId) => request(`/api/org/${orgId}/channels`, { token }),
    channelCreate: (token, orgId, input) => request(`/api/org/${orgId}/channels`, { method: "POST", token, body: input }),
    channelJoin: (token, orgId, channelId) => request(`/api/org/${orgId}/channels/${channelId}/join`, { method: "POST", token }),
    channelLeave: (token, orgId, channelId) => request(`/api/org/${orgId}/channels/${channelId}/leave`, { method: "POST", token }),
    channelMembers: (token, orgId, channelId) => request(`/api/org/${orgId}/channels/${channelId}/members`, { token }),
    messageList: (token, orgId, channelId, query) => {
      const params = new URLSearchParams();
      if (query?.limit) {
        params.set("limit", String(query.limit));
      }
      if (query?.before) {
        params.set("before", query.before);
      }
      if (query?.after) {
        params.set("after", query.after);
      }
      if (query?.around) {
        params.set("around", query.around);
      }
      if (query?.threadId) {
        params.set("threadId", query.threadId);
      }
      const search = params.toString();
      return request(`/api/org/${orgId}/channels/${channelId}/messages${search ? `?${search}` : ""}`, { token });
    },
    messageSend: (token, orgId, input) => request(`/api/org/${orgId}/messages/send`, { method: "POST", token, body: input }),
    messageEdit: (token, orgId, messageId, input) =>
      request(`/api/org/${orgId}/messages/${messageId}/edit`, { method: "POST", token, body: input }),
    messageDelete: (token, orgId, messageId) =>
      request(`/api/org/${orgId}/messages/${messageId}/delete`, { method: "POST", token }),
    messageReactionAdd: (token, orgId, messageId, input) =>
      request(`/api/org/${orgId}/messages/${messageId}/reactions/add`, { method: "POST", token, body: input }),
    messageReactionRemove: (token, orgId, messageId, input) =>
      request(`/api/org/${orgId}/messages/${messageId}/reactions/remove`, { method: "POST", token, body: input }),
    typingUpsert: (token, orgId, channelId, input) =>
      request(`/api/org/${orgId}/channels/${channelId}/typing`, { method: "POST", token, body: input }),
    typingList: (token, orgId, channelId) => request(`/api/org/${orgId}/channels/${channelId}/typing`, { token }),
    readStateSet: (token, orgId, channelId) => request(`/api/org/${orgId}/channels/${channelId}/read`, { method: "POST", token }),
    readStateGet: (token, orgId, channelId) => request(`/api/org/${orgId}/channels/${channelId}/read-state`, { token }),
    directList: (token, orgId) => request(`/api/org/${orgId}/directs`, { token }),
    directCreate: (token, orgId, input) => request(`/api/org/${orgId}/directs`, { method: "POST", token, body: input }),
    fileUploadInit: (token, orgId, input) =>
      request(`/api/org/${orgId}/files/upload-init`, { method: "POST", token, body: input }),
    fileUpload: (token, orgId, fileId, input) =>
      request(`/api/org/${orgId}/files/${fileId}/upload`, { method: "POST", token, body: input }),
    fileGet: (token, orgId, fileId) =>
      fetch(`${baseUrl}/api/org/${orgId}/files/${fileId}`, {
        headers: { Authorization: `Bearer ${token}` },
        redirect: "follow",
      }),
    searchMessages: (token, orgId, query) => {
      const params = new URLSearchParams();
      params.set("q", query.q);
      if (query.channelId) params.set("channelId", query.channelId);
      if (query.before !== undefined) params.set("before", String(query.before));
      if (query.limit !== undefined) params.set("limit", String(query.limit));
      return request(`/api/org/${orgId}/search/messages?${params.toString()}`, { token });
    },
    searchChannels: (token, orgId, query) => {
      const params = new URLSearchParams();
      params.set("q", query.q);
      if (query.limit !== undefined) params.set("limit", String(query.limit));
      return request(`/api/org/${orgId}/search/channels?${params.toString()}`, { token });
    },
    updatesDiff: (token, orgId, input) => request(`/api/org/${orgId}/updates/diff`, { method: "POST", token, body: input }),
    updatesStreamSubscribe: (token, orgId, onUpdate, onReady) => {
      const subscription = sseSubscribe({
        url: `${baseUrl}/api/org/${orgId}/updates/stream`,
        headers: {
          Authorization: `Bearer ${token}`
        },
        onEvent: (event) => {
          if (event.event === "ready") {
            onReady?.();
            return;
          }
          if (event.event === "ping") {
            return;
          }
          if (event.event !== "update") {
            return;
          }
          try {
            const update = JSON.parse(event.data) as UpdateEnvelope;
            onUpdate(update);
          } catch {
            // Ignore malformed update payloads.
          }
        }
      });
      return subscription;
    }
  };
}
