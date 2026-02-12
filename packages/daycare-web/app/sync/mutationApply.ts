import type { ApiClient } from "../daycare/api/apiClientCreate";
import type { RebaseShape } from "./eventMappers";

type PendingMutation = {
  id: string;
  name: string;
  input: Record<string, unknown>;
  timestamp: number;
};

type ApplyResult = {
  snapshot: RebaseShape;
  idMapping?: { type: string; clientId: string; serverId: string };
};

type MessageShape = {
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
  sender: { id: string; kind: string; username: string; firstName: string; lastName: string | null; avatarUrl: string | null };
  attachments: Array<{ id: string; kind: string; url: string; mimeType: string | null; fileName: string | null; sizeBytes: number | null; sortOrder: number }>;
  reactions: Array<{ id: string; userId: string; shortcode: string; createdAt: number }>;
};

type MutationContext = {
  userId: string;
  messageReactions?: Record<string, Array<{ userId: string; shortcode: string }>>;
  messages?: Record<string, MessageShape>;
};

// Maps each mutation name to the correct REST API call and returns
// a server-authoritative snapshot for engine.rebase()
export async function mutationApply(
  api: ApiClient,
  token: string,
  orgId: string,
  mutation: PendingMutation,
  context?: MutationContext,
): Promise<ApplyResult> {
  switch (mutation.name) {
    case "messageSend": {
      const input = mutation.input as {
        id: string;
        chatId: string;
        text: string;
        threadId?: string | null;
        attachments?: Array<{
          kind: string;
          url: string;
          mimeType?: string | null;
          fileName?: string | null;
          sizeBytes?: number | null;
        }>;
      };
      const result = await api.messageSend(token, orgId, {
        channelId: input.chatId,
        text: input.text,
        threadId: input.threadId,
        attachments: input.attachments,
      });
      const msg = result.message;
      // Use the client-generated ID in the snapshot so the React key stays
      // stable. The idMapping lets AppController rewrite SSE/sync data
      // that arrives with the server-assigned ID.
      return {
        snapshot: {
          message: [
            {
              id: input.id,
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
            },
          ],
        },
        idMapping: { type: "message", clientId: input.id, serverId: msg.id },
      };
    }

    case "messageEdit": {
      const input = mutation.input as { id: string; text: string };
      const result = await api.messageEdit(token, orgId, input.id, {
        text: input.text,
      });
      const msg = result.message;
      return {
        snapshot: {
          message: [
            {
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
            },
          ],
        },
      };
    }

    case "messageDelete": {
      const input = mutation.input as { id: string };
      await api.messageDelete(token, orgId, input.id);
      // Server confirms deletion; the SSE will deliver the updated message
      return { snapshot: {} };
    }

    case "reactionToggle": {
      const input = mutation.input as {
        messageId: string;
        shortcode: string;
      };
      // Determine intent from optimistic state: if the reaction now exists
      // in the draft, the toggle added it; if absent, the toggle removed it.
      const reactions = context?.messageReactions?.[input.messageId] ?? [];
      const wantsAdd = reactions.some(
        (r) => r.userId === context?.userId && r.shortcode === input.shortcode,
      );
      if (wantsAdd) {
        await api.messageReactionAdd(token, orgId, input.messageId, {
          shortcode: input.shortcode,
        });
      } else {
        await api.messageReactionRemove(token, orgId, input.messageId, {
          shortcode: input.shortcode,
        });
      }
      // Return the optimistic message state so reactions survive commit()
      const msg = context?.messages?.[input.messageId];
      if (msg) {
        return {
          snapshot: {
            message: [
              {
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
                sender: msg.sender,
                attachments: msg.attachments,
                reactions: msg.reactions,
              },
            ],
          },
        };
      }
      return { snapshot: {} };
    }

    case "channelCreate": {
      const input = mutation.input as {
        id: string;
        name: string;
        topic?: string | null;
        visibility?: "public" | "private";
      };
      const result = await api.channelCreate(token, orgId, {
        name: input.name,
        topic: input.topic,
        visibility: input.visibility,
      });
      const ch = result.channel;
      return {
        snapshot: {
          channel: [
            {
              id: ch.id,
              organizationId: ch.organizationId,
              name: ch.name,
              topic: ch.topic,
              visibility: ch.visibility,
              createdAt: ch.createdAt,
              updatedAt: ch.updatedAt,
            },
          ],
        },
      };
    }

    case "channelUpdate": {
      const input = mutation.input as {
        id: string;
        name?: string;
        topic?: string | null;
        visibility?: "public" | "private";
      };
      const result = await api.channelUpdate(token, orgId, input.id, {
        name: input.name,
        topic: input.topic,
        visibility: input.visibility,
      });
      const ch = result.channel;
      return {
        snapshot: {
          channel: [
            {
              id: ch.id,
              organizationId: ch.organizationId,
              name: ch.name,
              topic: ch.topic,
              visibility: ch.visibility,
              createdAt: ch.createdAt,
              updatedAt: ch.updatedAt,
            },
          ],
        },
      };
    }

    case "readMark": {
      const input = mutation.input as { chatId: string };
      const result = await api.readStateSet(token, orgId, input.chatId);
      return {
        snapshot: {
          readState: [
            {
              id: result.chatId,
              chatId: result.chatId,
              lastReadAt: result.lastReadAt,
              unreadCount: 0,
            },
          ],
        },
      };
    }

    default:
      throw new Error(`Unknown mutation: ${mutation.name}`);
  }
}
