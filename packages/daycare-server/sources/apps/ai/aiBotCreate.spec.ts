import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { aiBotCreate } from "./aiBotCreate.js";

describe("aiBotCreate", () => {
  it("creates an AI bot user", async () => {
    const context = {
      db: {
        user: {
          create: vi.fn().mockResolvedValue({
            id: "bot-1",
            organizationId: "org-1",
            kind: "AI",
            username: "helper",
            firstName: "Helper",
            systemPrompt: "You are helpful",
            webhookUrl: "https://example.com/webhook"
          })
        }
      }
    } as unknown as ApiContext;

    const bot = await aiBotCreate(context, {
      organizationId: "org-1",
      username: "helper",
      firstName: "Helper",
      systemPrompt: "You are helpful",
      webhookUrl: "https://example.com/webhook"
    });

    expect(bot.kind).toBe("AI");
    expect(bot.username).toBe("helper");
  });

  it("rejects duplicate usernames", async () => {
    const context = {
      db: {
        user: {
          create: vi.fn().mockRejectedValue(new Prisma.PrismaClientKnownRequestError(
            "duplicate",
            {
              code: "P2002",
              clientVersion: "6.19.2"
            }
          ))
        }
      }
    } as unknown as ApiContext;

    await expect(aiBotCreate(context, {
      organizationId: "org-1",
      username: "helper",
      firstName: "Helper",
      systemPrompt: "You are helpful",
      webhookUrl: "https://example.com/webhook"
    })).rejects.toMatchObject({ statusCode: 409 });
  });
});
