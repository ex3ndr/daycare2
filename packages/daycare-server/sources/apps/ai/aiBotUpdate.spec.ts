import { describe, expect, it, vi } from "vitest";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { aiBotUpdate } from "./aiBotUpdate.js";

describe("aiBotUpdate", () => {
  it("updates AI bot configuration", async () => {
    const context = {
      db: {
        user: {
          findFirst: vi.fn().mockResolvedValue({ id: "bot-1", kind: "AI" }),
          update: vi.fn().mockResolvedValue({
            id: "bot-1",
            kind: "AI",
            firstName: "Helper 2",
            webhookUrl: "https://example.com/new"
          })
        }
      }
    } as unknown as ApiContext;

    const bot = await aiBotUpdate(context, {
      organizationId: "org-1",
      userId: "bot-1",
      firstName: "Helper 2",
      webhookUrl: "https://example.com/new"
    });

    expect(bot.firstName).toBe("Helper 2");
  });

  it("returns 404 when bot does not exist", async () => {
    const context = {
      db: {
        user: {
          findFirst: vi.fn().mockResolvedValue(null),
          update: vi.fn()
        }
      }
    } as unknown as ApiContext;

    await expect(aiBotUpdate(context, {
      organizationId: "org-1",
      userId: "missing",
      webhookUrl: "https://example.com/new"
    })).rejects.toMatchObject({ statusCode: 404 });
  });
});
