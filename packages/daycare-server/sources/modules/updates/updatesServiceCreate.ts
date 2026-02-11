import type { Prisma, PrismaClient, UserUpdate } from "@prisma/client";
import type { FastifyReply } from "fastify";
import { createId } from "@paralleldrive/cuid2";
import { updatesBroadcast } from "./updatesBroadcast.js";
import { updatesChannelCreate } from "./updatesChannelCreate.js";

type UpdatePayload = Record<string, unknown>;

type UpdateClient = {
  id: string;
  userId: string;
  orgId: string;
  reply: FastifyReply;
};

export type UpdateEnvelope = {
  id: string;
  userId: string;
  seqno: number;
  eventType: string;
  payload: UpdatePayload;
  createdAt: number;
};

export type UpdatesDiffResult = {
  updates: UpdateEnvelope[];
  headOffset: number;
  resetRequired: boolean;
};

export type UpdatesService = {
  subscribe: (userId: string, orgId: string, reply: FastifyReply) => () => void;
  publishToUsers: (userIds: string[], eventType: string, payload: UpdatePayload) => Promise<void>;
  diffGet: (userId: string, offset: number, limit?: number) => Promise<UpdatesDiffResult>;
  stop: () => Promise<void>;
};

export type UpdatesRedisPubSub = {
  pub: {
    publish: (channel: string, message: string) => Promise<number>;
  };
  sub: {
    subscribe: (...channels: string[]) => Promise<unknown>;
    unsubscribe: (...channels: string[]) => Promise<unknown>;
    on: (event: "message", listener: (channel: string, message: string) => void) => unknown;
    off: (event: "message", listener: (channel: string, message: string) => void) => unknown;
  };
};

const MAX_RETAINED_UPDATES = 5000;

function updateToEnvelope(update: UserUpdate): UpdateEnvelope {
  return {
    id: update.id,
    userId: update.userId,
    seqno: update.seqno,
    eventType: update.eventType,
    payload: update.payloadJson as UpdatePayload,
    createdAt: update.createdAt.getTime()
  };
}

export function updatesServiceCreate(
  db: PrismaClient,
  redisPubSub?: UpdatesRedisPubSub
): UpdatesService {
  const clientsByUser = new Map<string, Map<string, UpdateClient>>();
  const subscribedUsers = new Set<string>();

  const localDeliver = (userId: string, envelope: UpdateEnvelope): void => {
    const clients = clientsByUser.get(userId);
    if (!clients) {
      return;
    }

    for (const client of clients.values()) {
      client.reply.raw.write(`event: update\ndata: ${JSON.stringify(envelope)}\n\n`);
    }
  };

  const redisMessageHandle = (channel: string, message: string): void => {
    const prefix = "updates:";
    if (!channel.startsWith(prefix)) {
      return;
    }

    const userId = channel.slice(prefix.length);
    if (!userId) {
      return;
    }

    try {
      const envelope = JSON.parse(message) as UpdateEnvelope;
      if (envelope && envelope.userId === userId) {
        localDeliver(userId, envelope);
      }
    } catch {
      // Ignore malformed pub/sub payloads.
    }
  };

  if (redisPubSub) {
    redisPubSub.sub.on("message", redisMessageHandle);
  }

  const subscriptionEnsure = async (userId: string): Promise<void> => {
    if (!redisPubSub || subscribedUsers.has(userId)) {
      return;
    }

    await redisPubSub.sub.subscribe(updatesChannelCreate(userId));
    subscribedUsers.add(userId);
  };

  const subscriptionRelease = async (userId: string): Promise<void> => {
    if (!redisPubSub || !subscribedUsers.has(userId)) {
      return;
    }

    const userClients = clientsByUser.get(userId);
    if (userClients && userClients.size > 0) {
      return;
    }

    await redisPubSub.sub.unsubscribe(updatesChannelCreate(userId));
    subscribedUsers.delete(userId);
  };

  const subscribe = (userId: string, orgId: string, reply: FastifyReply): (() => void) => {
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    });
    reply.raw.write("event: ready\ndata: {}\n\n");

    const client: UpdateClient = {
      id: createId(),
      userId,
      orgId,
      reply
    };

    const userClients = clientsByUser.get(userId) ?? new Map<string, UpdateClient>();
    userClients.set(client.id, client);
    clientsByUser.set(userId, userClients);
    void subscriptionEnsure(userId);

    return () => {
      const existing = clientsByUser.get(userId);
      if (!existing) {
        return;
      }

      existing.delete(client.id);
      if (existing.size === 0) {
        clientsByUser.delete(userId);
      }

      void subscriptionRelease(userId);
    };
  };

  const publishToUsers = async (userIds: string[], eventType: string, payload: UpdatePayload): Promise<void> => {
    const uniqueUserIds = Array.from(new Set(userIds));
    await Promise.all(uniqueUserIds.map(async (userId) => {
      if (eventType === "message.created") {
        const deliverable = await messageUpdateDeliverable(db, userId, payload);
        if (!deliverable) {
          return;
        }
      }

      const update = await updateCreateWithRetry(db, userId, eventType, payload);
      const envelope = updateToEnvelope(update);

      if (redisPubSub) {
        await updatesBroadcast(redisPubSub.pub, userId, envelope);
      } else {
        localDeliver(userId, envelope);
      }
    }));
  };

  const diffGet = async (userId: string, offset: number, limit = 200): Promise<UpdatesDiffResult> => {
    const head = await db.userUpdate.findFirst({
      where: { userId },
      orderBy: { seqno: "desc" },
      select: { seqno: true }
    });

    const updates = await db.userUpdate.findMany({
      where: {
        userId,
        seqno: {
          gt: offset
        }
      },
      orderBy: {
        seqno: "asc"
      },
      take: limit
    });

    const earliest = await db.userUpdate.findFirst({
      where: { userId },
      orderBy: { seqno: "asc" },
      select: { seqno: true }
    });

    const resetRequired = earliest ? offset < earliest.seqno - 1 : false;

    return {
      updates: updates.map(updateToEnvelope),
      headOffset: head?.seqno ?? 0,
      resetRequired
    };
  };

  const stop = async (): Promise<void> => {
    if (redisPubSub) {
      redisPubSub.sub.off("message", redisMessageHandle);

      const usersWithLocalClients = Array.from(clientsByUser.keys());
      const users = new Set<string>([...subscribedUsers.values(), ...usersWithLocalClients]);

      if (users.size > 0) {
        const channels = Array.from(users.values()).map((userId) => updatesChannelCreate(userId));
        await redisPubSub.sub.unsubscribe(...channels);
        subscribedUsers.clear();
      }
    }

    clientsByUser.clear();
  };

  return {
    subscribe,
    publishToUsers,
    diffGet,
    stop
  };
}

async function messageUpdateDeliverable(
  db: PrismaClient,
  userId: string,
  payload: UpdatePayload
): Promise<boolean> {
  const channelId = typeof payload.channelId === "string" ? payload.channelId : null;
  const messageId = typeof payload.messageId === "string" ? payload.messageId : null;

  if (!channelId || !messageId) {
    return true;
  }

  const membership = await db.chatMember.findFirst({
    where: {
      chatId: channelId,
      userId,
      leftAt: null
    },
    select: {
      notificationLevel: true,
      muteForever: true,
      muteUntil: true
    }
  });

  if (!membership) {
    return false;
  }

  if (membership.muteForever) {
    return false;
  }

  if (membership.muteUntil && membership.muteUntil.getTime() > Date.now()) {
    return false;
  }

  if (membership.notificationLevel === "ALL") {
    return true;
  }

  if (membership.notificationLevel === "MUTED") {
    return membership.muteUntil ? membership.muteUntil.getTime() <= Date.now() : false;
  }

  const mention = await db.messageMention.findFirst({
    where: {
      messageId,
      mentionedUserId: userId
    },
    select: {
      id: true
    }
  });

  return Boolean(mention);
}

async function updateCreateWithRetry(
  db: PrismaClient,
  userId: string,
  eventType: string,
  payload: UpdatePayload
): Promise<UserUpdate> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      const update = await db.$transaction(async (tx) => {
        // Serialize seqno allocation for each user in PostgreSQL.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;

        const latest = await tx.userUpdate.findFirst({
          where: { userId },
          orderBy: { seqno: "desc" },
          select: { seqno: true }
        });

        const created = await tx.userUpdate.create({
          data: {
            id: createId(),
            userId,
            seqno: (latest?.seqno ?? 0) + 1,
            eventType,
            payloadJson: payload as Prisma.InputJsonObject
          }
        });

        if (created.seqno > MAX_RETAINED_UPDATES && created.seqno % 100 === 0) {
          await updatesTrim(tx, userId);
        }

        return created;
      });
      return update;
    } catch (error) {
      const message = String(error);
      const uniqueConstraintViolation = message.includes("UserUpdate_userId_seqno_key");
      if (!uniqueConstraintViolation || attempt >= 5) {
        throw error;
      }
    }
  }

  throw new Error("Failed to write user update after retries");
}

async function updatesTrim(
  db: PrismaClient | Prisma.TransactionClient,
  userId: string
): Promise<void> {
  const oldUpdates = await db.userUpdate.findMany({
    where: { userId },
    orderBy: { seqno: "desc" },
    skip: MAX_RETAINED_UPDATES,
    select: { id: true }
  });

  if (oldUpdates.length === 0) {
    return;
  }

  await db.userUpdate.deleteMany({
    where: {
      id: {
        in: oldUpdates.map((item) => item.id)
      }
    }
  });
}
