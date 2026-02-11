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

export type RebaseShape = {
  message?: MessageRebaseItem[];
  channel?: ChannelRebaseItem[];
  direct?: DirectRebaseItem[];
  member?: MemberRebaseItem[];
  typing?: TypingRebaseItem[];
  readState?: ReadStateRebaseItem[];
  context?: { seqno: number };
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

export function mapEventToRebase(update: UpdateEnvelope): RebaseShape | null {
  const payload = update.payload;

  switch (update.eventType) {
    case "message.created":
    case "message.updated": {
      const msg = payload.message as Message | undefined;
      if (!msg) return null;
      return { message: [messageToRebase(msg)] };
    }

    case "message.deleted": {
      const msg = payload.message as Message | undefined;
      if (!msg) return null;
      return { message: [messageToRebase(msg)] };
    }

    case "channel.created":
    case "channel.updated": {
      const ch = payload.channel as Channel | undefined;
      if (!ch) return null;
      return { channel: [channelToRebase(ch)] };
    }

    case "member.joined": {
      const user = payload.user as User | undefined;
      if (!user) return null;
      return { member: [userToMember(user)] };
    }

    case "member.left": {
      // member.left doesn't remove from the member collection
      // (we keep member info for displaying past messages)
      return null;
    }

    case "member.updated": {
      const user = payload.user as User | undefined;
      if (!user) return null;
      return { member: [userToMember(user)] };
    }

    case "user.typing": {
      const typing = payload as {
        userId?: string;
        username?: string;
        firstName?: string;
        chatId?: string;
        expiresAt?: number;
      };
      if (!typing.userId || !typing.chatId || !typing.expiresAt) return null;
      // Use chatId+userId as the typing entry ID for deduplication
      const id = `${typing.chatId}:${typing.userId}`;
      return {
        typing: [
          {
            id,
            userId: typing.userId,
            username: typing.username ?? "",
            firstName: typing.firstName ?? "",
            expiresAt: typing.expiresAt,
          },
        ],
      };
    }

    case "user.presence": {
      // Presence updates are handled separately (not in sync engine collections)
      return null;
    }

    default:
      return null;
  }
}
