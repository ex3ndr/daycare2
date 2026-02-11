import { createHash } from "node:crypto";
import { createId } from "@paralleldrive/cuid2";
import { CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { apiCreate } from "@/apps/api/apiCreate.js";
import { testLiveContextCreate } from "@/utils/testLiveContextCreate.js";

type LiveContext = Awaited<ReturnType<typeof testLiveContextCreate>>;

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

function responseDataGet<T>(response: Awaited<ReturnType<FastifyInstance["inject"]>>): T {
  expect(response.statusCode).toBe(200);
  const payload = response.json() as ApiOk<T> | ApiFail;
  expect(payload.ok).toBe(true);
  if (!payload.ok) {
    throw new Error(payload.error.message);
  }
  return payload.data;
}

describe("routes live integration", () => {
  let live: LiveContext;
  let app: FastifyInstance;

  beforeAll(async () => {
    live = await testLiveContextCreate();

    app = await apiCreate(live.context);
    await app.ready();
  });

  beforeEach(async () => {
    await live.reset();

    try {
      await live.context.s3.send(new HeadBucketCommand({ Bucket: live.context.s3Bucket }));
    } catch {
      await live.context.s3.send(new CreateBucketCommand({ Bucket: live.context.s3Bucket }));
    }
  });

  afterAll(async () => {
    await app.close();
    await live.close();
  });

  async function login(email: string): Promise<string> {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email }
    });

    const data = responseDataGet<{ token: string }>(response);
    return data.token;
  }

  async function orgCreate(ownerToken: string): Promise<{ orgId: string; ownerUserId: string }> {
    const slug = `org-${createId().slice(0, 8)}`;
    const username = `owner-${createId().slice(0, 6)}`;

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/org/create",
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        slug,
        name: "Acme",
        firstName: "Owner",
        username
      }
    });

    const createData = responseDataGet<{ organization: { id: string } }>(createResponse);
    const orgId = createData.organization.id;

    const profileResponse = await app.inject({
      method: "GET",
      url: `/api/org/${orgId}/profile`,
      headers: { authorization: `Bearer ${ownerToken}` }
    });

    const profileData = responseDataGet<{ profile: { id: string } }>(profileResponse);

    return {
      orgId,
      ownerUserId: profileData.profile.id
    };
  }

  async function setupOrgWithTwoUsers(): Promise<{
    ownerToken: string;
    ownerUserId: string;
    memberToken: string;
    memberUserId: string;
    orgId: string;
    channelId: string;
  }> {
    const ownerToken = await login(`owner-${createId().slice(0, 8)}@example.com`);
    const { orgId, ownerUserId } = await orgCreate(ownerToken);

    const memberToken = await login(`member-${createId().slice(0, 8)}@example.com`);
    const joinResponse = await app.inject({
      method: "POST",
      url: `/api/org/${orgId}/join`,
      headers: { authorization: `Bearer ${memberToken}` },
      payload: {
        firstName: "Member",
        username: `member-${createId().slice(0, 6)}`
      }
    });

    const joinData = responseDataGet<{ user: { id: string } }>(joinResponse);
    const memberUserId = joinData.user.id;

    const channelCreateResponse = await app.inject({
      method: "POST",
      url: `/api/org/${orgId}/channels`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: `general-${createId().slice(0, 6)}`,
        visibility: "public"
      }
    });

    const channelCreateData = responseDataGet<{ channel: { id: string } }>(channelCreateResponse);

    return {
      ownerToken,
      ownerUserId,
      memberToken,
      memberUserId,
      orgId,
      channelId: channelCreateData.channel.id
    };
  }

  it("serves health routes", async () => {
    const health = await app.inject({ method: "GET", url: "/health" });
    expect(health.statusCode).toBe(200);
    expect((health.json() as { ok: boolean }).ok).toBe(true);

    const ready = await app.inject({ method: "GET", url: "/health/ready" });
    expect(ready.statusCode).toBe(200);
    const payload = ready.json() as {
      ok: boolean;
      checks: {
        database: { ok: boolean };
        redis: { ok: boolean };
      };
    };
    expect(payload.ok).toBe(true);
    expect(payload.checks.database.ok).toBe(true);
    expect(payload.checks.redis.ok).toBe(true);
  });

  it("handles organization, membership and profile routes", async () => {
    const ownerToken = await login(`owner-${createId().slice(0, 8)}@example.com`);
    const { orgId } = await orgCreate(ownerToken);

    const availableResponse = await app.inject({
      method: "GET",
      url: "/api/org/available",
      headers: { authorization: `Bearer ${ownerToken}` }
    });
    const availableData = responseDataGet<{ organizations: Array<{ id: string }> }>(availableResponse);
    expect(availableData.organizations.some((item) => item.id === orgId)).toBe(true);

    const profilePatchResponse = await app.inject({
      method: "PATCH",
      url: `/api/org/${orgId}/profile`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        firstName: "Owner Updated"
      }
    });
    const profilePatchData = responseDataGet<{ profile: { firstName: string } }>(profilePatchResponse);
    expect(profilePatchData.profile.firstName).toBe("Owner Updated");

    const membersResponse = await app.inject({
      method: "GET",
      url: `/api/org/${orgId}/members`,
      headers: { authorization: `Bearer ${ownerToken}` }
    });
    const membersData = responseDataGet<{ members: Array<{ id: string }> }>(membersResponse);
    expect(membersData.members.length).toBeGreaterThan(0);
  });

  it("handles channel and direct routes", async () => {
    const setup = await setupOrgWithTwoUsers();

    const joinResponse = await app.inject({
      method: "POST",
      url: `/api/org/${setup.orgId}/channels/${setup.channelId}/join`,
      headers: { authorization: `Bearer ${setup.memberToken}` }
    });
    responseDataGet(joinResponse);

    const membersResponse = await app.inject({
      method: "GET",
      url: `/api/org/${setup.orgId}/channels/${setup.channelId}/members`,
      headers: { authorization: `Bearer ${setup.ownerToken}` }
    });
    const membersData = responseDataGet<{ members: Array<{ userId: string }> }>(membersResponse);
    expect(membersData.members.some((member) => member.userId === setup.memberUserId)).toBe(true);

    const directResponse = await app.inject({
      method: "POST",
      url: `/api/org/${setup.orgId}/directs`,
      headers: { authorization: `Bearer ${setup.ownerToken}` },
      payload: {
        userId: setup.memberUserId
      }
    });
    const directData = responseDataGet<{ channel: { id: string; kind: string } }>(directResponse);
    expect(directData.channel.kind).toBe("direct");

    const directListResponse = await app.inject({
      method: "GET",
      url: `/api/org/${setup.orgId}/directs`,
      headers: { authorization: `Bearer ${setup.ownerToken}` }
    });
    const directListData = responseDataGet<{ directs: Array<{ channel: { id: string } }> }>(directListResponse);
    expect(directListData.directs.some((item) => item.channel.id === directData.channel.id)).toBe(true);

    const archiveResponse = await app.inject({
      method: "POST",
      url: `/api/org/${setup.orgId}/channels/${setup.channelId}/archive`,
      headers: { authorization: `Bearer ${setup.ownerToken}` }
    });
    responseDataGet(archiveResponse);

    const unarchiveResponse = await app.inject({
      method: "POST",
      url: `/api/org/${setup.orgId}/channels/${setup.channelId}/unarchive`,
      headers: { authorization: `Bearer ${setup.ownerToken}` }
    });
    responseDataGet(unarchiveResponse);

    const notificationResponse = await app.inject({
      method: "PATCH",
      url: `/api/org/${setup.orgId}/channels/${setup.channelId}/notifications`,
      headers: { authorization: `Bearer ${setup.memberToken}` },
      payload: {
        level: "MENTIONS_ONLY"
      }
    });
    const notificationData = responseDataGet<{ membership: { notificationLevel: string } }>(notificationResponse);
    expect(notificationData.membership.notificationLevel).toBe("mentions_only");
  });

  it("handles message, read, typing, search and updates routes", async () => {
    const setup = await setupOrgWithTwoUsers();

    await app.inject({
      method: "POST",
      url: `/api/org/${setup.orgId}/channels/${setup.channelId}/join`,
      headers: { authorization: `Bearer ${setup.memberToken}` }
    });

    const sendResponse = await app.inject({
      method: "POST",
      url: `/api/org/${setup.orgId}/messages/send`,
      headers: { authorization: `Bearer ${setup.ownerToken}` },
      payload: {
        channelId: setup.channelId,
        text: "alphakeyword message"
      }
    });
    const sendData = responseDataGet<{ message: { id: string } }>(sendResponse);

    const listResponse = await app.inject({
      method: "GET",
      url: `/api/org/${setup.orgId}/channels/${setup.channelId}/messages`,
      headers: { authorization: `Bearer ${setup.ownerToken}` }
    });
    const listData = responseDataGet<{ messages: Array<{ id: string }> }>(listResponse);
    expect(listData.messages.some((message) => message.id === sendData.message.id)).toBe(true);

    const addReactionResponse = await app.inject({
      method: "POST",
      url: `/api/org/${setup.orgId}/messages/${sendData.message.id}/reactions/add`,
      headers: { authorization: `Bearer ${setup.memberToken}` },
      payload: {
        shortcode: ":+1:"
      }
    });
    responseDataGet(addReactionResponse);

    const removeReactionResponse = await app.inject({
      method: "POST",
      url: `/api/org/${setup.orgId}/messages/${sendData.message.id}/reactions/remove`,
      headers: { authorization: `Bearer ${setup.memberToken}` },
      payload: {
        shortcode: ":+1:"
      }
    });
    responseDataGet(removeReactionResponse);

    const readStateBefore = await app.inject({
      method: "GET",
      url: `/api/org/${setup.orgId}/channels/${setup.channelId}/read-state`,
      headers: { authorization: `Bearer ${setup.memberToken}` }
    });
    const readStateBeforeData = responseDataGet<{ unreadCount: number }>(readStateBefore);
    expect(readStateBeforeData.unreadCount).toBeGreaterThan(0);

    const readResponse = await app.inject({
      method: "POST",
      url: `/api/org/${setup.orgId}/channels/${setup.channelId}/read`,
      headers: { authorization: `Bearer ${setup.memberToken}` }
    });
    responseDataGet(readResponse);

    const typingSet = await app.inject({
      method: "POST",
      url: `/api/org/${setup.orgId}/channels/${setup.channelId}/typing`,
      headers: { authorization: `Bearer ${setup.memberToken}` },
      payload: {}
    });
    responseDataGet(typingSet);

    const typingGet = await app.inject({
      method: "GET",
      url: `/api/org/${setup.orgId}/channels/${setup.channelId}/typing`,
      headers: { authorization: `Bearer ${setup.memberToken}` }
    });
    const typingData = responseDataGet<{ typing: Array<{ userId: string }> }>(typingGet);
    expect(typingData.typing.length).toBeGreaterThan(0);

    const searchMessages = await app.inject({
      method: "GET",
      url: `/api/org/${setup.orgId}/search/messages?q=alphakeyword`,
      headers: { authorization: `Bearer ${setup.memberToken}` }
    });
    const searchMessagesData = responseDataGet<{ messages: Array<{ id: string }> }>(searchMessages);
    expect(searchMessagesData.messages.some((message) => message.id === sendData.message.id)).toBe(true);

    const searchChannels = await app.inject({
      method: "GET",
      url: `/api/org/${setup.orgId}/search/channels?q=general`,
      headers: { authorization: `Bearer ${setup.memberToken}` }
    });
    const searchChannelsData = responseDataGet<{ channels: Array<{ id: string }> }>(searchChannels);
    expect(searchChannelsData.channels.length).toBeGreaterThan(0);

    const updatesDiff = await app.inject({
      method: "POST",
      url: `/api/org/${setup.orgId}/updates/diff`,
      headers: { authorization: `Bearer ${setup.ownerToken}` },
      payload: {
        offset: 0,
        limit: 50
      }
    });
    const updatesDiffData = responseDataGet<{ updates: Array<{ id: string }>; headOffset: number }>(updatesDiff);
    expect(updatesDiffData.headOffset).toBeGreaterThan(0);
  });

  it("handles presence routes", async () => {
    const setup = await setupOrgWithTwoUsers();

    const setPresence = await app.inject({
      method: "POST",
      url: `/api/org/${setup.orgId}/presence`,
      headers: { authorization: `Bearer ${setup.memberToken}` },
      payload: {
        status: "online"
      }
    });
    responseDataGet(setPresence);

    const heartbeat = await app.inject({
      method: "POST",
      url: `/api/org/${setup.orgId}/presence/heartbeat`,
      headers: { authorization: `Bearer ${setup.memberToken}` }
    });
    responseDataGet(heartbeat);

    const getPresence = await app.inject({
      method: "GET",
      url: `/api/org/${setup.orgId}/presence?userIds=${setup.memberUserId},${setup.ownerUserId}`,
      headers: { authorization: `Bearer ${setup.ownerToken}` }
    });
    const presenceData = responseDataGet<{ presence: Array<{ userId: string; status: string }> }>(getPresence);
    expect(presenceData.presence.some((entry) => entry.userId === setup.memberUserId)).toBe(true);
  });

  it("handles AI bot routes", async () => {
    const ownerToken = await login(`owner-${createId().slice(0, 8)}@example.com`);
    const { orgId } = await orgCreate(ownerToken);
    const ownerChannelResponse = await app.inject({
      method: "POST",
      url: `/api/org/${orgId}/channels`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: `owners-${createId().slice(0, 6)}`,
        visibility: "public"
      }
    });
    responseDataGet(ownerChannelResponse);

    const botUsername = `bot-${createId().slice(0, 6)}`;
    const createBotResponse = await app.inject({
      method: "POST",
      url: `/api/org/${orgId}/bots`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        username: botUsername,
        firstName: "Helper",
        systemPrompt: "You are helpful",
        webhookUrl: "https://example.com/webhook"
      }
    });
    const createBotData = responseDataGet<{ bot: { id: string; username: string } }>(createBotResponse);
    expect(createBotData.bot.username).toBe(botUsername);

    const listBotsResponse = await app.inject({
      method: "GET",
      url: `/api/org/${orgId}/bots`,
      headers: { authorization: `Bearer ${ownerToken}` }
    });
    const listBotsData = responseDataGet<{ bots: Array<{ id: string }> }>(listBotsResponse);
    expect(listBotsData.bots.some((bot) => bot.id === createBotData.bot.id)).toBe(true);

    const updateBotResponse = await app.inject({
      method: "PATCH",
      url: `/api/org/${orgId}/bots/${createBotData.bot.id}`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        firstName: "Helper Updated"
      }
    });
    const updateBotData = responseDataGet<{ bot: { firstName: string } }>(updateBotResponse);
    expect(updateBotData.bot.firstName).toBe("Helper Updated");
  });

  it("handles file upload routes", async () => {
    const ownerToken = await login(`owner-${createId().slice(0, 8)}@example.com`);
    const { orgId } = await orgCreate(ownerToken);

    const payload = Buffer.from("hello-file");
    const contentHash = createHash("sha256").update(payload).digest("hex");

    const initResponse = await app.inject({
      method: "POST",
      url: `/api/org/${orgId}/files/upload-init`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        filename: "hello.txt",
        mimeType: "text/plain",
        sizeBytes: payload.length,
        contentHash
      }
    });
    const initData = responseDataGet<{ file: { id: string } }>(initResponse);

    const uploadResponse = await app.inject({
      method: "POST",
      url: `/api/org/${orgId}/files/${initData.file.id}/upload`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        payloadBase64: payload.toString("base64")
      }
    });
    responseDataGet(uploadResponse);

    const getFileResponse = await app.inject({
      method: "GET",
      url: `/api/org/${orgId}/files/${initData.file.id}`,
      headers: { authorization: `Bearer ${ownerToken}` }
    });

    expect(getFileResponse.statusCode).toBe(302);
    expect(getFileResponse.headers.location).toContain("X-Amz");
  });
});
