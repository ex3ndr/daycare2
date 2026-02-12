import { z } from "zod";

const idSchema = z.string().min(1);
const unixMsSchema = z.number().int();
const nullableUnixMsSchema = unixMsSchema.nullable();
const orgRoleWireSchema = z.enum(["OWNER", "MEMBER", "owner", "member"]);
const orgRoleSchema = z.enum(["owner", "member"]);
const userKindSchema = z.enum(["human", "ai"]);
const channelVisibilitySchema = z.enum(["public", "private"]);
const channelNotificationLowerSchema = z.enum(["all", "mentions_only", "muted"]);
const presenceStatusSchema = z.enum(["online", "away", "offline"]);
const presenceMutableStatusSchema = z.enum(["online", "away"]);

const accountSchema = z.object({
  id: idSchema,
  email: z.string().email(),
  createdAt: unixMsSchema,
  updatedAt: unixMsSchema,
});

const sessionSchema = z.object({
  id: idSchema,
  expiresAt: unixMsSchema,
});

const organizationSchema = z.object({
  id: idSchema,
  slug: z.string().min(1),
  name: z.string().min(1),
  avatarUrl: z.string().nullable(),
  createdAt: unixMsSchema,
  updatedAt: unixMsSchema,
});

const userSummarySchema = z.object({
  id: idSchema,
  kind: userKindSchema,
  username: z.string().min(1),
  firstName: z.string(),
  lastName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});

const organizationMemberSchema = userSummarySchema.extend({
  orgRole: orgRoleWireSchema.optional(),
  deactivatedAt: nullableUnixMsSchema,
  createdAt: unixMsSchema,
  updatedAt: unixMsSchema,
});

const organizationJoinUserSchema = z.object({
  id: idSchema,
  organizationId: idSchema,
  username: z.string().min(1),
  firstName: z.string(),
  lastName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  orgRole: orgRoleWireSchema.optional(),
  deactivatedAt: nullableUnixMsSchema,
  createdAt: unixMsSchema,
  updatedAt: unixMsSchema,
});

const userProfileSchema = z.object({
  id: idSchema,
  organizationId: idSchema,
  kind: userKindSchema,
  username: z.string().min(1),
  firstName: z.string(),
  lastName: z.string().nullable(),
  bio: z.string().nullable().optional(),
  timezone: z.string().nullable().optional(),
  avatarUrl: z.string().nullable(),
  systemPrompt: z.string().nullable().optional(),
  orgRole: orgRoleWireSchema.optional(),
  deactivatedAt: nullableUnixMsSchema,
  createdAt: unixMsSchema,
  updatedAt: unixMsSchema,
});

const channelSchema = z.object({
  id: idSchema,
  organizationId: idSchema,
  name: z.string(),
  topic: z.string().nullable(),
  visibility: channelVisibilitySchema,
  createdAt: unixMsSchema,
  updatedAt: unixMsSchema,
});

const channelMemberSchema = z.object({
  chatId: idSchema,
  userId: idSchema,
  role: orgRoleSchema,
  joinedAt: unixMsSchema,
  leftAt: nullableUnixMsSchema.optional().default(null),
  notificationLevel: channelNotificationLowerSchema.optional(),
});

const messageAttachmentSchema = z.object({
  id: idSchema,
  kind: z.string().min(1),
  url: z.string().min(1),
  mimeType: z.string().nullable(),
  fileName: z.string().nullable(),
  sizeBytes: z.number().int().nullable(),
  sortOrder: z.number().int(),
});

const messageReactionSchema = z.object({
  id: idSchema,
  userId: idSchema,
  shortcode: z.string().min(1),
  createdAt: unixMsSchema,
});

const messageSchema = z.object({
  id: idSchema,
  chatId: idSchema,
  senderUserId: idSchema,
  threadId: idSchema.nullable(),
  text: z.string(),
  createdAt: unixMsSchema,
  editedAt: nullableUnixMsSchema,
  deletedAt: nullableUnixMsSchema,
  threadReplyCount: z.number().int(),
  threadLastReplyAt: nullableUnixMsSchema,
  sender: userSummarySchema,
  attachments: z.array(messageAttachmentSchema),
  reactions: z.array(messageReactionSchema),
});

const typingStateSchema = z.object({
  userId: idSchema,
  username: z.string().min(1),
  firstName: z.string(),
  expiresAt: unixMsSchema,
});

const readStateSchema = z.object({
  chatId: idSchema,
  lastReadAt: nullableUnixMsSchema,
  unreadCount: z.number().int().nonnegative(),
});

const directSchema = z.object({
  channel: channelSchema.extend({
    kind: z.literal("direct"),
  }),
  otherUser: userSummarySchema,
});

const fileAssetSchema = z.object({
  id: idSchema,
  organizationId: idSchema,
  contentHash: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int(),
  status: z.enum(["pending", "committed", "deleted"]),
  createdAt: unixMsSchema,
  expiresAt: nullableUnixMsSchema.optional(),
  committedAt: nullableUnixMsSchema.optional(),
});

const messageSearchResultSchema = z.object({
  id: idSchema,
  chatId: idSchema,
  senderUserId: idSchema,
  text: z.string(),
  highlight: z.string(),
  createdAt: unixMsSchema,
});

const channelSearchResultSchema = z.object({
  id: idSchema,
  organizationId: idSchema,
  name: z.string().nullable(),
  topic: z.string().nullable(),
  visibility: channelVisibilitySchema,
  createdAt: unixMsSchema,
  updatedAt: unixMsSchema,
});

const updateEnvelopeSchema = z.object({
  id: idSchema,
  userId: idSchema,
  seqno: z.number().int().nonnegative(),
  eventType: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  createdAt: unixMsSchema,
});

const updatesDiffResultSchema = z.object({
  updates: z.array(updateEnvelopeSchema),
  headOffset: z.number().int().nonnegative(),
  resetRequired: z.boolean(),
});

const orgInviteSchema = z.object({
  id: idSchema,
  organizationId: idSchema,
  invitedByUserId: idSchema.nullable().optional(),
  email: z.string().email(),
  expired: z.boolean().optional(),
  expiresAt: unixMsSchema,
  acceptedAt: nullableUnixMsSchema,
  revokedAt: nullableUnixMsSchema,
  createdAt: unixMsSchema,
});

const orgDomainSchema = z.object({
  id: idSchema,
  organizationId: idSchema,
  domain: z.string().min(1),
  createdByUserId: idSchema,
  createdAt: unixMsSchema,
});

export const apiSchemas = {
  authLogin: z.object({
    token: z.string().min(1),
    account: accountSchema,
    session: sessionSchema,
  }),
  authRequestOtp: z.object({
    sent: z.boolean(),
    expiresInSeconds: z.number().int().positive(),
  }),
  authVerifyOtp: z.object({
    token: z.string().min(1),
    account: accountSchema,
    session: sessionSchema,
  }),
  authLogout: z.object({
    revoked: z.boolean(),
  }),
  meGet: z.object({
    account: accountSchema,
    organizations: z.array(organizationSchema),
  }),
  organizationAvailableList: z.object({
    organizations: z.array(organizationSchema),
  }),
  organizationCreate: z.object({
    organization: organizationSchema,
  }),
  organizationJoin: z.object({
    joined: z.boolean(),
    user: organizationJoinUserSchema,
  }),
  organizationGet: z.object({
    organization: organizationSchema,
  }),
  organizationMembers: z.object({
    members: z.array(organizationMemberSchema),
  }),
  profileGet: z.object({
    profile: userProfileSchema,
  }),
  profilePatch: z.object({
    profile: userProfileSchema,
  }),
  channelList: z.object({
    channels: z.array(channelSchema),
  }),
  channelCreate: z.object({
    channel: channelSchema,
  }),
  channelJoin: z.object({
    joined: z.boolean(),
    membership: channelMemberSchema,
  }),
  channelLeave: z.object({
    left: z.boolean(),
    membership: channelMemberSchema,
  }),
  channelMembers: z.object({
    members: z.array(channelMemberSchema.extend({ user: userSummarySchema })),
  }),
  messageList: z.object({
    messages: z.array(messageSchema),
  }),
  messageSend: z.object({
    message: messageSchema,
  }),
  messageEdit: z.object({
    message: messageSchema,
  }),
  messageDelete: z.object({
    deleted: z.boolean(),
    messageId: idSchema,
  }),
  messageReactionAdd: z.object({
    added: z.boolean(),
  }),
  messageReactionRemove: z.object({
    removed: z.boolean(),
  }),
  typingUpsert: z.object({
    ok: z.literal(true),
    expiresAt: unixMsSchema,
  }),
  typingList: z.object({
    typing: z.array(typingStateSchema),
  }),
  readStateSet: z.object({
    chatId: idSchema,
    lastReadAt: unixMsSchema,
  }),
  readStateGet: readStateSchema,
  directList: z.object({
    directs: z.array(directSchema),
  }),
  directCreate: z.object({
    channel: channelSchema.extend({
      kind: z.literal("direct"),
    }),
  }),
  fileUploadInit: z.object({
    file: fileAssetSchema,
    upload: z.object({
      method: z.string().min(1),
      contentType: z.string().min(1),
      url: z.string().min(1),
    }),
  }),
  fileUpload: z.object({
    file: fileAssetSchema,
  }),
  searchMessages: z.object({
    messages: z.array(messageSearchResultSchema),
  }),
  searchChannels: z.object({
    channels: z.array(channelSearchResultSchema),
  }),
  channelUpdate: z.object({
    channel: channelSchema,
  }),
  channelArchive: z.object({
    channel: channelSchema,
  }),
  channelUnarchive: z.object({
    channel: channelSchema,
  }),
  channelMemberKick: z.object({
    removed: z.boolean(),
  }),
  channelMemberRoleUpdate: z.object({
    updated: z.boolean(),
  }),
  channelNotificationsUpdate: z.object({
    membership: z.object({
      notificationLevel: channelNotificationLowerSchema,
    }),
  }),
  presenceSet: z.object({
    presence: z.object({
      userId: idSchema,
      status: presenceMutableStatusSchema,
    }),
  }),
  presenceHeartbeat: z.object({
    presence: z.object({
      userId: idSchema,
      status: presenceStatusSchema,
    }),
  }),
  presenceGet: z.object({
    requesterUserId: idSchema,
    presence: z.array(
      z.object({
        userId: idSchema,
        status: presenceStatusSchema,
      }),
    ),
  }),
  updatesDiff: updatesDiffResultSchema,
  updateEnvelope: updateEnvelopeSchema,
  orgMemberDeactivate: z.object({
    user: z.object({
      id: idSchema,
      deactivatedAt: nullableUnixMsSchema,
    }),
  }),
  orgMemberReactivate: z.object({
    user: z.object({
      id: idSchema,
      deactivatedAt: nullableUnixMsSchema,
    }),
  }),
  orgMemberRoleSet: z.object({
    user: z.object({
      id: idSchema,
      orgRole: orgRoleWireSchema,
    }),
  }),
  orgInviteCreate: z.object({
    invite: orgInviteSchema,
  }),
  orgInviteList: z.object({
    invites: z.array(orgInviteSchema),
  }),
  orgInviteRevoke: z.object({
    invite: z.object({
      id: idSchema,
      revokedAt: nullableUnixMsSchema,
    }),
  }),
  orgDomainAdd: z.object({
    domain: orgDomainSchema,
  }),
  orgDomainList: z.object({
    domains: z.array(orgDomainSchema),
  }),
  orgDomainRemove: z.object({
    removed: z.boolean(),
  }),
  channelMemberAdd: z.object({
    added: z.boolean(),
    membership: channelMemberSchema,
  }),
  organizationUpdate: z.object({
    organization: organizationSchema,
  }),
};
