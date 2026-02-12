import type {
  Account,
  Channel,
  ChannelMember,
  ChannelSearchResult,
  Direct,
  Message,
  MessageListResponse,
  MessageSearchResult,
  OrganizationMember,
  OrgDomain,
  OrgInvite,
  Organization,
  OrgRole,
  ReadState,
  Session,
  TypingState,
  EphemeralEnvelope,
  UpdateEnvelope,
  UpdatesDiffResult,
  User,
  UserSummary,
} from "../types";
import type { z } from "zod";
import { orgRoleNormalize } from "../orgRoleNormalize";
import { ApiError, apiRequest, apiRequestFireUnauthorized } from "./apiRequest";
import { apiSchemas } from "./apiSchemas";
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
  imageWidth: number | null;
  imageHeight: number | null;
  imageThumbhash: string | null;
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
    user: {
      id: string;
      organizationId: string;
      username: string;
      firstName: string;
      lastName: string | null;
      avatarUrl: string | null;
      orgRole?: OrgRole;
      deactivatedAt: number | null;
      createdAt: number;
      updatedAt: number;
    };
  }>;
  organizationGet: (token: string, orgId: string) => Promise<{ organization: Organization }>;
  organizationMembers: (token: string, orgId: string) => Promise<{ members: OrganizationMember[] }>;
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
  channelMembers: (token: string, orgId: string, channelId: string) => Promise<{ members: Array<ChannelMember & { user: UserSummary }> }>;
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
      messageId: string;
      channelId: string;
      text: string;
      threadId?: string | null;
      attachments?: Array<{
        kind: string;
        fileId: string;
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
  channelUpdate: (
    token: string,
    orgId: string,
    channelId: string,
    input: { name?: string; topic?: string | null; visibility?: "public" | "private" }
  ) => Promise<{ channel: Channel }>;
  channelArchive: (token: string, orgId: string, channelId: string) => Promise<{ archived: boolean }>;
  channelUnarchive: (token: string, orgId: string, channelId: string) => Promise<{ unarchived: boolean }>;
  channelMemberKick: (
    token: string,
    orgId: string,
    channelId: string,
    userId: string
  ) => Promise<{ kicked: boolean }>;
  channelMemberRoleUpdate: (
    token: string,
    orgId: string,
    channelId: string,
    userId: string,
    input: { role: "owner" | "member" }
  ) => Promise<{ updated: boolean }>;
  channelNotificationsUpdate: (
    token: string,
    orgId: string,
    channelId: string,
    input: { setting: "ALL" | "MENTIONS_ONLY" | "MUTED" }
  ) => Promise<{ setting: "ALL" | "MENTIONS_ONLY" | "MUTED" }>;
  presenceSet: (token: string, orgId: string, input: { status: "online" | "away" }) => Promise<{ presence: { userId: string; status: "online" | "away" } }>;
  presenceHeartbeat: (token: string, orgId: string) => Promise<{ presence: { userId: string; status: "online" | "away" | "offline" } }>;
  presenceGet: (token: string, orgId: string, userIds: string[]) => Promise<{ requesterUserId: string; presence: Array<{ userId: string; status: "online" | "away" | "offline" }> }>;
  updatesDiff: (token: string, orgId: string, input: { offset: number; limit?: number }) => Promise<UpdatesDiffResult>;
  updatesStreamSubscribe: (
    token: string,
    orgId: string,
    onUpdate: (update: UpdateEnvelope) => void,
    onReady?: () => void,
    onDisconnect?: () => void,
    onEphemeral?: (event: EphemeralEnvelope) => void,
  ) => { close: () => void };
  orgMemberDeactivate: (token: string, orgId: string, userId: string) => Promise<{ user: { id: string; deactivatedAt: number | null } }>;
  orgMemberReactivate: (token: string, orgId: string, userId: string) => Promise<{ user: { id: string; deactivatedAt: number | null } }>;
  orgMemberRoleSet: (token: string, orgId: string, userId: string, input: { role: "OWNER" | "MEMBER" }) => Promise<{ user: { id: string; orgRole: OrgRole } }>;
  orgInviteCreate: (token: string, orgId: string, input: { email: string }) => Promise<{ invite: OrgInvite }>;
  orgInviteList: (token: string, orgId: string) => Promise<{ invites: OrgInvite[] }>;
  orgInviteRevoke: (token: string, orgId: string, inviteId: string) => Promise<{ invite: { id: string; revokedAt: number | null } }>;
  orgDomainAdd: (token: string, orgId: string, input: { domain: string }) => Promise<{ domain: OrgDomain }>;
  orgDomainList: (token: string, orgId: string) => Promise<{ domains: OrgDomain[] }>;
  orgDomainRemove: (token: string, orgId: string, domainId: string) => Promise<{ removed: boolean }>;
  channelMemberAdd: (token: string, orgId: string, channelId: string, input: { userId: string }) => Promise<{ added: boolean; membership: ChannelMember }>;
  organizationUpdate: (token: string, orgId: string, input: { name?: string; avatarUrl?: string | null }) => Promise<{ organization: Organization }>;
};

const DEFAULT_BASE_URL = "http://localhost:3005";

export function apiClientCreate(baseUrl: string = DEFAULT_BASE_URL): ApiClient {
  const request = <T>(
    path: string,
    schema: z.ZodType<T>,
    options: { token?: string | null; method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown } = {},
  ) =>
    apiRequest<T>({
      baseUrl,
      path,
      method: options.method,
      token: options.token,
      body: options.body,
      schema,
    });

  return {
    authLogin: (email) =>
      request("/api/auth/login", apiSchemas.authLogin, { method: "POST", body: { email } }),
    authRequestOtp: (email) =>
      request("/api/auth/email/request-otp", apiSchemas.authRequestOtp, { method: "POST", body: { email } }),
    authVerifyOtp: (email, code) =>
      request("/api/auth/email/verify-otp", apiSchemas.authVerifyOtp, { method: "POST", body: { email, code } }),
    authLogout: (token) => request("/api/auth/logout", apiSchemas.authLogout, { method: "POST", token }),
    meGet: (token) => request("/api/me", apiSchemas.meGet, { token }),
    organizationAvailableList: (token) =>
      request("/api/org/available", apiSchemas.organizationAvailableList, { token }),
    organizationCreate: (token, input) =>
      request("/api/org/create", apiSchemas.organizationCreate, { method: "POST", token, body: input }),
    organizationJoin: async (token, orgId, input) => {
      const result = await request(`/api/org/${orgId}/join`, apiSchemas.organizationJoin, {
        method: "POST",
        token,
        body: input,
      });
      return {
        ...result,
        user: {
          ...result.user,
          orgRole: orgRoleNormalize(result.user.orgRole),
        },
      };
    },
    organizationGet: (token, orgId) =>
      request(`/api/org/${orgId}`, apiSchemas.organizationGet, { token }),
    organizationMembers: async (token, orgId) => {
      const result = await request(`/api/org/${orgId}/members`, apiSchemas.organizationMembers, { token });
      return {
        members: result.members.map((member) => ({
          ...member,
          orgRole: orgRoleNormalize(member.orgRole),
        })) as OrganizationMember[],
      };
    },
    profileGet: async (token, orgId) => {
      const result = await request(`/api/org/${orgId}/profile`, apiSchemas.profileGet, { token });
      return {
        profile: {
          ...result.profile,
          orgRole: orgRoleNormalize(result.profile.orgRole),
        } as User,
      };
    },
    profilePatch: async (token, orgId, input) => {
      const result = await request(`/api/org/${orgId}/profile`, apiSchemas.profilePatch, {
        method: "PATCH",
        token,
        body: input,
      });
      return {
        profile: {
          ...result.profile,
          orgRole: orgRoleNormalize(result.profile.orgRole),
        } as User,
      };
    },
    channelList: (token, orgId) => request(`/api/org/${orgId}/channels`, apiSchemas.channelList, { token }),
    channelCreate: (token, orgId, input) =>
      request(`/api/org/${orgId}/channels`, apiSchemas.channelCreate, { method: "POST", token, body: input }),
    channelJoin: async (token, orgId, channelId) => {
      const result = await request(`/api/org/${orgId}/channels/${channelId}/join`, apiSchemas.channelJoin, { method: "POST", token });
      return {
        ...result,
        membership: { ...result.membership, leftAt: result.membership.leftAt ?? null },
      };
    },
    channelLeave: async (token, orgId, channelId) => {
      const result = await request(`/api/org/${orgId}/channels/${channelId}/leave`, apiSchemas.channelLeave, { method: "POST", token });
      return {
        ...result,
        membership: { ...result.membership, leftAt: result.membership.leftAt ?? null },
      };
    },
    channelMembers: async (token, orgId, channelId) => {
      const result = await request(
        `/api/org/${orgId}/channels/${channelId}/members`,
        apiSchemas.channelMembers,
        { token },
      );
      return {
        members: result.members.map((member) => ({
          ...member,
          leftAt: member.leftAt ?? null,
        })),
      };
    },
    messageList: async (token, orgId, channelId, query) => {
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
      const result = await request(
        `/api/org/${orgId}/channels/${channelId}/messages${search ? `?${search}` : ""}`,
        apiSchemas.messageList,
        { token },
      );
      return {
        messages: result.messages.map((message) => ({
          ...message,
          attachments: message.attachments.map((attachment) => ({
            ...attachment,
            imageWidth: attachment.imageWidth ?? null,
            imageHeight: attachment.imageHeight ?? null,
            imageThumbhash: attachment.imageThumbhash ?? null,
          })),
        })),
      };
    },
    messageSend: async (token, orgId, input) => {
      const result = await request(`/api/org/${orgId}/messages/send`, apiSchemas.messageSend, { method: "POST", token, body: input });
      return {
        message: {
          ...result.message,
          attachments: result.message.attachments.map((attachment) => ({
            ...attachment,
            imageWidth: attachment.imageWidth ?? null,
            imageHeight: attachment.imageHeight ?? null,
            imageThumbhash: attachment.imageThumbhash ?? null,
          })),
        },
      };
    },
    messageEdit: async (token, orgId, messageId, input) => {
      const result = await request(`/api/org/${orgId}/messages/${messageId}/edit`, apiSchemas.messageEdit, { method: "POST", token, body: input });
      return {
        message: {
          ...result.message,
          attachments: result.message.attachments.map((attachment) => ({
            ...attachment,
            imageWidth: attachment.imageWidth ?? null,
            imageHeight: attachment.imageHeight ?? null,
            imageThumbhash: attachment.imageThumbhash ?? null,
          })),
        },
      };
    },
    messageDelete: (token, orgId, messageId) =>
      request(`/api/org/${orgId}/messages/${messageId}/delete`, apiSchemas.messageDelete, { method: "POST", token }),
    messageReactionAdd: (token, orgId, messageId, input) =>
      request(`/api/org/${orgId}/messages/${messageId}/reactions/add`, apiSchemas.messageReactionAdd, { method: "POST", token, body: input }),
    messageReactionRemove: (token, orgId, messageId, input) =>
      request(`/api/org/${orgId}/messages/${messageId}/reactions/remove`, apiSchemas.messageReactionRemove, { method: "POST", token, body: input }),
    typingUpsert: (token, orgId, channelId, input) =>
      request(`/api/org/${orgId}/channels/${channelId}/typing`, apiSchemas.typingUpsert, { method: "POST", token, body: input }),
    typingList: (token, orgId, channelId) =>
      request(`/api/org/${orgId}/channels/${channelId}/typing`, apiSchemas.typingList, { token }),
    readStateSet: (token, orgId, channelId) =>
      request(`/api/org/${orgId}/channels/${channelId}/read`, apiSchemas.readStateSet, { method: "POST", token }),
    readStateGet: (token, orgId, channelId) =>
      request(`/api/org/${orgId}/channels/${channelId}/read-state`, apiSchemas.readStateGet, { token }),
    directList: (token, orgId) =>
      request(`/api/org/${orgId}/directs`, apiSchemas.directList, { token }),
    directCreate: (token, orgId, input) =>
      request(`/api/org/${orgId}/directs`, apiSchemas.directCreate, { method: "POST", token, body: input }),
    fileUploadInit: async (token, orgId, input) => {
      const result = await request(`/api/org/${orgId}/files/upload-init`, apiSchemas.fileUploadInit, {
        method: "POST",
        token,
        body: input,
      });
      return {
        ...result,
        file: {
          ...result.file,
          expiresAt: result.file.expiresAt ?? null,
          committedAt: result.file.committedAt ?? null,
          imageWidth: result.file.imageWidth ?? null,
          imageHeight: result.file.imageHeight ?? null,
          imageThumbhash: result.file.imageThumbhash ?? null,
        },
      };
    },
    fileUpload: async (token, orgId, fileId, input) => {
      const result = await request(`/api/org/${orgId}/files/${fileId}/upload`, apiSchemas.fileUpload, {
        method: "POST",
        token,
        body: input,
      });
      return {
        file: {
          ...result.file,
          expiresAt: result.file.expiresAt ?? null,
          committedAt: result.file.committedAt ?? null,
          imageWidth: result.file.imageWidth ?? null,
          imageHeight: result.file.imageHeight ?? null,
          imageThumbhash: result.file.imageThumbhash ?? null,
        },
      };
    },
    fileGet: async (token, orgId, fileId) => {
      const response = await fetch(`${baseUrl}/api/org/${orgId}/files/${fileId}`, {
        headers: { Authorization: `Bearer ${token}` },
        redirect: "follow",
      });
      if (response.status === 401) {
        apiRequestFireUnauthorized();
        throw new ApiError("Session expired", "UNAUTHORIZED", 401);
      }
      if (!response.ok) {
        throw new ApiError(`HTTP ${response.status}`, "HTTP_ERROR", response.status);
      }
      return response;
    },
    searchMessages: (token, orgId, query) => {
      const params = new URLSearchParams();
      params.set("q", query.q);
      if (query.channelId) params.set("channelId", query.channelId);
      if (query.before !== undefined) params.set("before", String(query.before));
      if (query.limit !== undefined) params.set("limit", String(query.limit));
      return request(`/api/org/${orgId}/search/messages?${params.toString()}`, apiSchemas.searchMessages, { token });
    },
    searchChannels: (token, orgId, query) => {
      const params = new URLSearchParams();
      params.set("q", query.q);
      if (query.limit !== undefined) params.set("limit", String(query.limit));
      return request(`/api/org/${orgId}/search/channels?${params.toString()}`, apiSchemas.searchChannels, { token });
    },
    channelUpdate: (token, orgId, channelId, input) =>
      request(`/api/org/${orgId}/channels/${channelId}`, apiSchemas.channelUpdate, { method: "PATCH", token, body: input }),
    channelArchive: async (token, orgId, channelId) => {
      await request(`/api/org/${orgId}/channels/${channelId}/archive`, apiSchemas.channelArchive, { method: "POST", token });
      return { archived: true };
    },
    channelUnarchive: async (token, orgId, channelId) => {
      await request(`/api/org/${orgId}/channels/${channelId}/unarchive`, apiSchemas.channelUnarchive, { method: "POST", token });
      return { unarchived: true };
    },
    channelMemberKick: async (token, orgId, channelId, userId) => {
      const result = await request(
        `/api/org/${orgId}/channels/${channelId}/members/${userId}/kick`,
        apiSchemas.channelMemberKick,
        { method: "POST", token },
      );
      return { kicked: result.removed };
    },
    channelMemberRoleUpdate: async (token, orgId, channelId, userId, input) => {
      const role = input.role.toUpperCase() as "OWNER" | "MEMBER";
      const result = await request(
        `/api/org/${orgId}/channels/${channelId}/members/${userId}/role`,
        apiSchemas.channelMemberRoleUpdate,
        { method: "PATCH", token, body: { role } },
      );
      return { updated: result.updated };
    },
    channelNotificationsUpdate: async (token, orgId, channelId, input) => {
      const result = await request(
        `/api/org/${orgId}/channels/${channelId}/notifications`,
        apiSchemas.channelNotificationsUpdate,
        { method: "PATCH", token, body: { level: input.setting } },
      );
      return { setting: result.membership.notificationLevel.toUpperCase() as "ALL" | "MENTIONS_ONLY" | "MUTED" };
    },
    presenceSet: (token, orgId, input) =>
      request(`/api/org/${orgId}/presence`, apiSchemas.presenceSet, { method: "POST", token, body: input }),
    presenceHeartbeat: (token, orgId) =>
      request(`/api/org/${orgId}/presence/heartbeat`, apiSchemas.presenceHeartbeat, { method: "POST", token }),
    presenceGet: (token, orgId, userIds) => {
      const params = new URLSearchParams();
      params.set("userIds", userIds.join(","));
      return request(`/api/org/${orgId}/presence?${params.toString()}`, apiSchemas.presenceGet, { token });
    },
    updatesDiff: (token, orgId, input) =>
      request(`/api/org/${orgId}/updates/diff`, apiSchemas.updatesDiff, { method: "POST", token, body: input }),
    updatesStreamSubscribe: (token, orgId, onUpdate, onReady, onDisconnect, onEphemeral) => {
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
          if (event.event === "ephemeral") {
            try {
              const payload = JSON.parse(event.data) as EphemeralEnvelope;
              onEphemeral?.(payload);
            } catch {
              // Ignore malformed ephemeral payloads.
            }
            return;
          }
          if (event.event !== "update") {
            return;
          }
          const updatePayload = JSON.parse(event.data);
          const update = apiSchemas.updateEnvelope.parse(updatePayload) as UpdateEnvelope;
          onUpdate(update);
        },
        onError: () => {
          onDisconnect?.();
        },
        onEnd: () => {
          onDisconnect?.();
        },
        onUnauthorized: () => {
          apiRequestFireUnauthorized();
        },
      });
      return subscription;
    },
    orgMemberDeactivate: (token, orgId, userId) =>
      request(`/api/org/${orgId}/members/${userId}/deactivate`, apiSchemas.orgMemberDeactivate, { method: "POST", token }),
    orgMemberReactivate: (token, orgId, userId) =>
      request(`/api/org/${orgId}/members/${userId}/reactivate`, apiSchemas.orgMemberReactivate, { method: "POST", token }),
    orgMemberRoleSet: async (token, orgId, userId, input) => {
      const result = await request(
        `/api/org/${orgId}/members/${userId}/role`,
        apiSchemas.orgMemberRoleSet,
        { method: "PATCH", token, body: input },
      );
      return {
        user: {
          id: result.user.id,
          orgRole: orgRoleNormalize(result.user.orgRole) ?? "member",
        },
      };
    },
    orgInviteCreate: (token, orgId, input) =>
      request(`/api/org/${orgId}/invites`, apiSchemas.orgInviteCreate, { method: "POST", token, body: input }),
    orgInviteList: (token, orgId) =>
      request(`/api/org/${orgId}/invites`, apiSchemas.orgInviteList, { token }),
    orgInviteRevoke: (token, orgId, inviteId) =>
      request(`/api/org/${orgId}/invites/${inviteId}/revoke`, apiSchemas.orgInviteRevoke, { method: "POST", token }),
    orgDomainAdd: (token, orgId, input) =>
      request(`/api/org/${orgId}/domains`, apiSchemas.orgDomainAdd, { method: "POST", token, body: input }),
    orgDomainList: (token, orgId) =>
      request(`/api/org/${orgId}/domains`, apiSchemas.orgDomainList, { token }),
    orgDomainRemove: (token, orgId, domainId) =>
      request(`/api/org/${orgId}/domains/${domainId}`, apiSchemas.orgDomainRemove, { method: "DELETE", token }),
    channelMemberAdd: async (token, orgId, channelId, input) => {
      const result = await request(`/api/org/${orgId}/channels/${channelId}/members`, apiSchemas.channelMemberAdd, {
        method: "POST",
        token,
        body: input,
      });
      return {
        ...result,
        membership: { ...result.membership, leftAt: result.membership.leftAt ?? null },
      };
    },
    organizationUpdate: (token, orgId, input) =>
      request(`/api/org/${orgId}`, apiSchemas.organizationUpdate, { method: "PATCH", token, body: input }),
  };
}
