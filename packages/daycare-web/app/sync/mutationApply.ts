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
};

// Maps each mutation name to the correct REST API call and returns
// a server-authoritative snapshot for engine.rebase()
export async function mutationApply(
  api: ApiClient,
  token: string,
  orgId: string,
  mutation: PendingMutation,
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
      // Add returns { added: boolean }. If not added (reaction already exists), remove instead.
      const result = await api.messageReactionAdd(token, orgId, input.messageId, {
        shortcode: input.shortcode,
      });
      if (!result.added) {
        await api.messageReactionRemove(token, orgId, input.messageId, {
          shortcode: input.shortcode,
        });
      }
      // Server confirms via SSE; no snapshot needed
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
