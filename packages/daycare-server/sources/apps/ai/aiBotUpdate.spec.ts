import { createId } from "@paralleldrive/cuid2";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testLiveContextCreate } from "@/utils/testLiveContextCreate.js";
import { aiBotUpdate } from "./aiBotUpdate.js";

type LiveContext = Awaited<ReturnType<typeof testLiveContextCreate>>;

describe("aiBotUpdate", () => {
  let live: LiveContext;

  beforeAll(async () => {
    live = await testLiveContextCreate();
  });

  beforeEach(async () => {
    await live.reset();
  });

  afterAll(async () => {
    await live.close();
  });

  async function seedBot() {
    const orgId = createId();
    const botId = createId();

    await live.db.organization.create({
      data: {
        id: orgId,
        slug: `org-${createId().slice(0, 8)}`,
        name: "Acme"
      }
    });

    await live.db.user.create({
      data: {
        id: botId,
        organizationId: orgId,
        kind: "AI",
        firstName: "Helper",
        username: `helper-${createId().slice(0, 6)}`,
        systemPrompt: "Old prompt",
        webhookUrl: "https://example.com/old"
      }
    });

    return { orgId, botId };
  }

  it("updates AI bot configuration", async () => {
    const { orgId, botId } = await seedBot();

    const bot = await aiBotUpdate(live.context, {
      organizationId: orgId,
      userId: botId,
      firstName: "Helper 2",
      webhookUrl: "https://example.com/new"
    });

    expect(bot.firstName).toBe("Helper 2");
    expect(bot.webhookUrl).toBe("https://example.com/new");
  });

  it("returns 404 when bot does not exist", async () => {
    const { orgId } = await seedBot();

    await expect(aiBotUpdate(live.context, {
      organizationId: orgId,
      userId: createId(),
      webhookUrl: "https://example.com/new"
    })).rejects.toMatchObject({ statusCode: 404 });
  });
});
