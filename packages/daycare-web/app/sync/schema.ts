import { defineSchema, field, localField, mutation, object, type } from "@slopus/sync";
import type { InferSchema } from "@slopus/sync";

export const schema = defineSchema({
  channel: type({
    fields: {
      organizationId: field<string>(),
      name: field<string>(),
      topic: field<string | null>(),
      visibility: field<"public" | "private">(),
      createdAt: field<number>(),
      updatedAt: field<number>(),
      isJoined: localField<boolean>(false),
    },
  }),

  message: type({
    fields: {
      chatId: field<string>(),
      senderUserId: field<string>(),
      threadId: field<string | null>(),
      text: field<string>(),
      createdAt: field<number>(),
      editedAt: field<number | null>(),
      deletedAt: field<number | null>(),
      threadReplyCount: field<number>(),
      threadLastReplyAt: field<number | null>(),
      sender: field<{
        id: string;
        kind: string;
        username: string;
        firstName: string;
        lastName: string | null;
        avatarUrl: string | null;
      }>(),
      attachments: field<
        Array<{
          id: string;
          kind: string;
          url: string;
          mimeType: string | null;
          fileName: string | null;
          sizeBytes: number | null;
          sortOrder: number;
        }>
      >(),
      reactions: field<
        Array<{
          id: string;
          userId: string;
          shortcode: string;
          createdAt: number;
        }>
      >(),
      pending: localField<boolean>(false),
    },
  }),

  member: type({
    fields: {
      kind: field<"human" | "ai">(),
      username: field<string>(),
      firstName: field<string>(),
      lastName: field<string | null>(),
      avatarUrl: field<string | null>(),
    },
  }),

  readState: type({
    fields: {
      chatId: field<string>(),
      lastReadAt: field<number | null>(),
      unreadCount: field<number>(),
    },
  }),

  direct: type({
    fields: {
      organizationId: field<string>(),
      createdAt: field<number>(),
      updatedAt: field<number>(),
      otherUser: field<{
        id: string;
        kind: "human" | "ai";
        username: string;
        firstName: string;
        lastName: string | null;
        avatarUrl: string | null;
      }>(),
    },
  }),

  typing: type({
    fields: {
      userId: field<string>(),
      username: field<string>(),
      firstName: field<string>(),
      expiresAt: field<number>(),
    },
  }),

  context: object({
    fields: {
      userId: field<string>(),
      orgId: field<string>(),
      orgSlug: field<string>(),
      orgName: field<string>(),
      seqno: localField<number>(0),
    },
  }),
}).withMutations({
  messageSend: mutation(
    (
      draft,
      input: {
        id: string;
        chatId: string;
        text: string;
        threadId?: string | null;
      },
    ) => {
      draft.message[input.id] = {
        id: input.id,
        chatId: input.chatId,
        senderUserId: draft.context.userId,
        threadId: input.threadId ?? null,
        text: input.text,
        createdAt: Date.now(),
        editedAt: null,
        deletedAt: null,
        threadReplyCount: 0,
        threadLastReplyAt: null,
        sender: {
          id: draft.context.userId,
          kind: "human",
          username: "",
          firstName: "",
          lastName: null,
          avatarUrl: null,
        },
        attachments: [],
        reactions: [],
        pending: true,
      };
    },
  ),

  messageEdit: mutation(
    (draft, input: { id: string; text: string }) => {
      const msg = draft.message[input.id];
      if (msg) {
        msg.text = input.text;
        msg.editedAt = Date.now();
      }
    },
  ),

  messageDelete: mutation((draft, input: { id: string }) => {
    const msg = draft.message[input.id];
    if (msg) {
      msg.deletedAt = Date.now();
    }
  }),

  reactionToggle: mutation(
    (draft, input: { messageId: string; shortcode: string }) => {
      const msg = draft.message[input.messageId];
      if (!msg) return;

      const userId = draft.context.userId;
      const existingIdx = msg.reactions.findIndex(
        (r) => r.userId === userId && r.shortcode === input.shortcode,
      );

      if (existingIdx >= 0) {
        msg.reactions.splice(existingIdx, 1);
      } else {
        msg.reactions.push({
          id: `${userId}-${input.shortcode}`,
          userId,
          shortcode: input.shortcode,
          createdAt: Date.now(),
        });
      }
    },
  ),

  channelCreate: mutation(
    (
      draft,
      input: {
        id: string;
        name: string;
        topic?: string | null;
        visibility?: "public" | "private";
      },
    ) => {
      draft.channel[input.id] = {
        id: input.id,
        organizationId: draft.context.orgId,
        name: input.name,
        topic: input.topic ?? null,
        visibility: input.visibility ?? "public",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isJoined: true,
      };
    },
  ),

  readMark: mutation((draft, input: { chatId: string }) => {
    const rs = draft.readState[input.chatId];
    if (rs) {
      rs.lastReadAt = Date.now();
      rs.unreadCount = 0;
    } else {
      draft.readState[input.chatId] = {
        id: input.chatId,
        chatId: input.chatId,
        lastReadAt: Date.now(),
        unreadCount: 0,
      };
    }
  }),
});

export type Schema = InferSchema<typeof schema>;
