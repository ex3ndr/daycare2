import type { UpdateEnvelope, Message, Channel, User } from "../daycare/types";

// Partial rebase shapes for engine.rebase()
// Each mapper returns a partial server update matching the sync schema collections

type MessageRebaseItem = {
  id: string;
  chatId: string;
  senderUserId: string;
  threadId: string | null;
  text: string;
  createdAt: number;
  editedAt: number | null;
  deletedAt: number | null;
  threadReplyCount: number;
  threadLastReplyAt: number | null;
  sender: {
    id: string;
    kind: string;
    username: string;
    firstName: string;
    lastName: string | null;
    avatarUrl: string | null;
  };
  attachments: Array<{
    id: string;
    kind: string;
    url: string;
    mimeType: string | null;
    fileName: string | null;
    sizeBytes: number | null;
    sortOrder: number;
    imageWidth: number | null;
    imageHeight: number | null;
    imageThumbhash: string | null;
  }>;
  reactions: Array<{
    id: string;
    userId: string;
    shortcode: string;
    createdAt: number;
  }>;
};

type ChannelRebaseItem = {
  id: string;
  organizationId: string;
  name: string;
  topic: string | null;
  visibility: "public" | "private";
  createdAt: number;
  updatedAt: number;
};

type MemberRebaseItem = {
  id: string;
  kind: "human" | "ai";
  username: string;
  firstName: string;
  lastName: string | null;
  avatarUrl: string | null;
};

type TypingRebaseItem = {
  id: string;
  userId: string;
  username: string;
  firstName: string;
  expiresAt: number;
};

type ReadStateRebaseItem = {
  id: string;
  chatId: string;
  lastReadAt: number | null;
  unreadCount: number;
};

type DirectRebaseItem = {
  id: string;
  organizationId: string;
  createdAt: number;
  updatedAt: number;
  otherUser: {
    id: string;
    kind: "human" | "ai";
    username: string;
    firstName: string;
    lastName: string | null;
    avatarUrl: string | null;
  };
};

type PresenceRebaseItem = {
  id: string;
  userId: string;
  status: "online" | "away" | "offline";
  lastSeenAt: number;
};

export type RebaseShape = {
  message?: MessageRebaseItem[];
  channel?: ChannelRebaseItem[];
  direct?: DirectRebaseItem[];
  member?: MemberRebaseItem[];
  typing?: TypingRebaseItem[];
  readState?: ReadStateRebaseItem[];
  presence?: PresenceRebaseItem[];
  context?: { seqno: number };
};

// Events that only carry IDs (not full objects) require a resync
export type EventMapResult = {
  rebase: RebaseShape | null;
  resyncChannels?: boolean;
  resyncMessages?: string; // channelId to resync messages for
  deactivatedUserId?: string; // userId deactivated from the org
};

function messageToRebase(msg: Message): MessageRebaseItem {
  return {
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
  };
}

function channelToRebase(ch: Channel): ChannelRebaseItem {
  return {
    id: ch.id,
    organizationId: ch.organizationId,
    name: ch.name,
    topic: ch.topic,
    visibility: ch.visibility,
    createdAt: ch.createdAt,
    updatedAt: ch.updatedAt,
  };
}

function userToMember(user: User): MemberRebaseItem {
  return {
    id: user.id,
    kind: user.kind,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
  };
}

export function mapEventToRebase(update: UpdateEnvelope): EventMapResult {
  const payload = update.payload;

  switch (update.eventType) {
    case "message.created":
    case "message.updated": {
      const msg = payload.message as Message | undefined;
      if (!msg) {
        // Server sends ID-only payloads; request a message resync for this channel
        const channelId = payload.channelId as string | undefined;
        return { rebase: null, resyncMessages: channelId };
      }
      return { rebase: { message: [messageToRebase(msg)] } };
    }

    case "message.deleted": {
      const msg = payload.message as Message | undefined;
      if (!msg) {
        const channelId = payload.channelId as string | undefined;
        return { rebase: null, resyncMessages: channelId };
      }
      return { rebase: { message: [messageToRebase(msg)] } };
    }

    case "message.reaction": {
      // Server sends { orgId, channelId, messageId, action, userId, shortcode }
      // We need a message resync to get the updated reaction state
      const channelId = payload.channelId as string | undefined;
      return { rebase: null, resyncMessages: channelId };
    }

    case "channel.created":
    case "channel.updated": {
      const ch = payload.channel as Channel | undefined;
      if (!ch) {
        // Server sends ID-only payloads; request a channel resync
        return { rebase: null, resyncChannels: true };
      }
      return { rebase: { channel: [channelToRebase(ch)] } };
    }

    case "member.joined": {
      const user = payload.user as User | undefined;
      if (!user) return { rebase: null };
      return { rebase: { member: [userToMember(user)] } };
    }

    case "member.left": {
      // member.left doesn't remove from the member collection
      // (we keep member info for displaying past messages)
      return { rebase: null };
    }

    case "member.updated": {
      const user = payload.user as User | undefined;
      if (!user) return { rebase: null };
      return { rebase: { member: [userToMember(user)] } };
    }

    case "user.typing": {
      const typing = payload as {
        userId?: string;
        username?: string;
        firstName?: string;
        chatId?: string;
        expiresAt?: number;
      };
      if (!typing.userId || !typing.chatId || !typing.expiresAt) return { rebase: null };
      // Use chatId+userId as the typing entry ID for deduplication
      const id = `${typing.chatId}:${typing.userId}`;
      return {
        rebase: {
          typing: [
            {
              id,
              userId: typing.userId,
              username: typing.username ?? "",
              firstName: typing.firstName ?? "",
              expiresAt: typing.expiresAt,
            },
          ],
        },
      };
    }

    case "user.presence": {
      const presence = payload as {
        userId?: string;
        status?: "online" | "away" | "offline";
      };
      if (!presence.userId || !presence.status) return { rebase: null };
      return {
        rebase: {
          presence: [
            {
              id: presence.userId,
              userId: presence.userId,
              status: presence.status,
              lastSeenAt: update.createdAt,
            },
          ],
        },
      };
    }

    case "organization.member.deactivated": {
      const userId = payload.userId as string | undefined;
      if (!userId) return { rebase: null };
      return { rebase: null, deactivatedUserId: userId };
    }

    default:
      return { rebase: null };
  }
}
