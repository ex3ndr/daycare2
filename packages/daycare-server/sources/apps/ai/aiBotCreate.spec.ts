import { createId } from "@paralleldrive/cuid2";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testLiveContextCreate } from "@/utils/testLiveContextCreate.js";
import { aiBotCreate } from "./aiBotCreate.js";

type LiveContext = Awaited<ReturnType<typeof testLiveContextCreate>>;

describe("aiBotCreate", () => {
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

  async function seedOrganization() {
    const orgId = createId();

    await live.db.organization.create({
      data: {
        id: orgId,
        slug: `org-${createId().slice(0, 8)}`,
        name: "Acme"
      }
    });

    return { orgId };
  }

  it("creates an AI bot user", async () => {
    const { orgId } = await seedOrganization();

    const username = `helper-${createId().slice(0, 6)}`;
    const bot = await aiBotCreate(live.context, {
      organizationId: orgId,
      username,
      firstName: "Helper",
      systemPrompt: "You are helpful",
      webhookUrl: "https://example.com/webhook"
    });

    expect(bot.kind).toBe("AI");
    expect(bot.username).toBe(username);
  });

  it("rejects duplicate usernames", async () => {
    const { orgId } = await seedOrganization();
    const username = `helper-${createId().slice(0, 6)}`;

    await live.db.user.create({
      data: {
        id: createId(),
        organizationId: orgId,
        kind: "AI",
        firstName: "Existing",
        username,
        systemPrompt: "existing prompt",
        webhookUrl: "https://example.com/existing"
      }
    });

    await expect(aiBotCreate(live.context, {
      organizationId: orgId,
      username,
      firstName: "Helper",
      systemPrompt: "You are helpful",
      webhookUrl: "https://example.com/webhook"
    })).rejects.toMatchObject({ statusCode: 409 });
  });
});
