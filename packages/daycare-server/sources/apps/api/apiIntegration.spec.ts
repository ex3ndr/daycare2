import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import type Redis from "ioredis";
import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { apiCreate } from "./apiCreate.js";
import { databaseConnect } from "../../modules/database/databaseConnect.js";
import { databaseCreate } from "../../modules/database/databaseCreate.js";
import { redisConnect } from "../../modules/redis/redisConnect.js";
import { redisCreate } from "../../modules/redis/redisCreate.js";
import { tokenServiceCreate } from "../../modules/auth/tokenServiceCreate.js";
import { updatesServiceCreate } from "../../modules/updates/updatesServiceCreate.js";

const integrationEnabled = process.env.INTEGRATION === "1";
const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const redisUrl = process.env.TEST_REDIS_URL ?? process.env.REDIS_URL;
const resolvedDatabaseUrl = databaseUrl ?? "";
const resolvedRedisUrl = redisUrl ?? "";

if (integrationEnabled && (!databaseUrl || !redisUrl)) {
  throw new Error("INTEGRATION=1 requires DATABASE_URL and REDIS_URL (or TEST_DATABASE_URL/TEST_REDIS_URL).");
}

const describeIntegration = integrationEnabled && databaseUrl && redisUrl ? describe : describe.skip;

type ApiOk<T> = {
  ok: true;
  data: T;
};

type ApiFail = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};

describeIntegration("api integration", () => {
  let app: FastifyInstance;
  let db: PrismaClient;
  let redis: Redis;

  beforeAll(async () => {
    db = databaseCreate(resolvedDatabaseUrl);
    await databaseConnect(db);

    redis = redisCreate(resolvedRedisUrl);
    await redisConnect(redis);

    const tokenSeed = process.env.TOKEN_SEED ?? "daycare-test-seed-00000000000000000000000000000000";
    const tokenService = process.env.TOKEN_SERVICE ?? "daycare-test";
    const tokens = await tokenServiceCreate(tokenService, tokenSeed);

    const updates = updatesServiceCreate(db);
    app = await apiCreate({
      db,
      redis,
      tokens,
      updates,
      nodeEnv: "test",
      allowOpenOrgJoin: true
    });
    await app.ready();
  });

  beforeEach(async () => {
    await db.$executeRawUnsafe(
      'TRUNCATE TABLE "UserUpdate", "ChatTypingState", "MessageReaction", "MessageAttachment", "MessageMention", "Message", "Thread", "ChatMember", "Chat", "FileAsset", "Session", "User", "Account", "Organization" RESTART IDENTITY CASCADE;'
    );
    await redis.flushall();
  });

  afterAll(async () => {
    await app.close();
    await redis.quit();
    await db.$disconnect();
  });

  it("executes core auth/org/channel/message/read/typing/updates flow", async () => {
    const ownerLogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        email: "owner@example.com"
      }
    });

    const ownerPayload = ownerLogin.json() as ApiOk<{ token: string; account: { id: string } }> | ApiFail;
    expect(ownerPayload.ok).toBe(true);
    if (!ownerPayload.ok) {
      throw new Error(ownerPayload.error.message);
    }

    const ownerToken = ownerPayload.data.token;
    const ownerAccountId = ownerPayload.data.account.id;

    const orgCreate = await app.inject({
      method: "POST",
      url: "/api/org/create",
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        slug: "acme",
        name: "Acme",
        firstName: "Owner",
        username: "owner"
      }
    });

    const orgPayload = orgCreate.json() as ApiOk<{ organization: { id: string } }> | ApiFail;
    expect(orgPayload.ok).toBe(true);
    if (!orgPayload.ok) {
      throw new Error(orgPayload.error.message);
    }

    const orgId = orgPayload.data.organization.id;

    const memberLogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        email: "member@example.com"
      }
    });

    const memberPayload = memberLogin.json() as ApiOk<{ token: string; account: { id: string } }> | ApiFail;
    expect(memberPayload.ok).toBe(true);
    if (!memberPayload.ok) {
      throw new Error(memberPayload.error.message);
    }

    const memberToken = memberPayload.data.token;

    const orgJoin = await app.inject({
      method: "POST",
      url: `/api/org/${orgId}/join`,
      headers: {
        authorization: `Bearer ${memberToken}`
      },
      payload: {
        firstName: "Member",
        username: "member"
      }
    });

    const joinPayload = orgJoin.json() as ApiOk<{ user: { id: string; username: string } }> | ApiFail;
    expect(joinPayload.ok).toBe(true);
    if (!joinPayload.ok) {
      throw new Error(joinPayload.error.message);
    }

    const memberUserId = joinPayload.data.user.id;
    const memberUsername = joinPayload.data.user.username;

    const channelCreate = await app.inject({
      method: "POST",
      url: `/api/org/${orgId}/channels`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        name: "general",
        visibility: "public"
      }
    });

    const channelPayload = channelCreate.json() as ApiOk<{ channel: { id: string } }> | ApiFail;
    expect(channelPayload.ok).toBe(true);
    if (!channelPayload.ok) {
      throw new Error(channelPayload.error.message);
    }

    const channelId = channelPayload.data.channel.id;

    const messageSend = await app.inject({
      method: "POST",
      url: `/api/org/${orgId}/messages/send`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        channelId,
        text: `Hello @${memberUsername}`
      }
    });

    const messagePayload = messageSend.json() as ApiOk<{ message: { id: string } }> | ApiFail;
    expect(messagePayload.ok).toBe(true);
    if (!messagePayload.ok) {
      throw new Error(messagePayload.error.message);
    }

    const messageId = messagePayload.data.message.id;

    const mentions = await db.messageMention.findMany({
      where: {
        messageId
      }
    });
    expect(mentions).toHaveLength(1);
    expect(mentions[0]?.mentionedUserId).toBe(memberUserId);

    const messageList = await app.inject({
      method: "GET",
      url: `/api/org/${orgId}/channels/${channelId}/messages`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    });

    const listPayload = messageList.json() as ApiOk<{ messages: Array<{ id: string }> }> | ApiFail;
    expect(listPayload.ok).toBe(true);
    if (!listPayload.ok) {
      throw new Error(listPayload.error.message);
    }
    expect(listPayload.data.messages.length).toBe(1);

    const preRead = await app.inject({
      method: "GET",
      url: `/api/org/${orgId}/channels/${channelId}/read-state`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    });

    const preReadPayload = preRead.json() as ApiOk<{ unreadCount: number }> | ApiFail;
    expect(preReadPayload.ok).toBe(true);
    if (!preReadPayload.ok) {
      throw new Error(preReadPayload.error.message);
    }
    expect(preReadPayload.data.unreadCount).toBe(1);

    await app.inject({
      method: "POST",
      url: `/api/org/${orgId}/channels/${channelId}/read`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    });

    const postRead = await app.inject({
      method: "GET",
      url: `/api/org/${orgId}/channels/${channelId}/read-state`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    });

    const postReadPayload = postRead.json() as ApiOk<{ unreadCount: number }> | ApiFail;
    expect(postReadPayload.ok).toBe(true);
    if (!postReadPayload.ok) {
      throw new Error(postReadPayload.error.message);
    }
    expect(postReadPayload.data.unreadCount).toBe(0);

    await app.inject({
      method: "POST",
      url: `/api/org/${orgId}/channels/${channelId}/typing`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        threadRootMessageId: null
      }
    });

    const typingList = await app.inject({
      method: "GET",
      url: `/api/org/${orgId}/channels/${channelId}/typing`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    });

    const typingPayload = typingList.json() as ApiOk<{ typing: Array<{ userId: string }> }> | ApiFail;
    expect(typingPayload.ok).toBe(true);
    if (!typingPayload.ok) {
      throw new Error(typingPayload.error.message);
    }
    const ownerUser = await db.user.findFirst({
      where: {
        organizationId: orgId,
        accountId: ownerAccountId
      }
    });
    expect(ownerUser).not.toBeNull();
    if (ownerUser) {
      expect(typingPayload.data.typing.some((item) => item.userId === ownerUser.id)).toBe(true);
    }

    const diff = await app.inject({
      method: "POST",
      url: `/api/org/${orgId}/updates/diff`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        offset: 0,
        limit: 50
      }
    });

    const diffPayload = diff.json() as ApiOk<{ updates: Array<{ eventType: string }> }> | ApiFail;
    expect(diffPayload.ok).toBe(true);
    if (!diffPayload.ok) {
      throw new Error(diffPayload.error.message);
    }

    const eventTypes = diffPayload.data.updates.map((item) => item.eventType);
    expect(eventTypes).toContain("organization.created");
    expect(eventTypes).toContain("channel.created");
    expect(eventTypes).toContain("message.created");
  });
});
