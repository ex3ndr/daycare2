import { describe, expect, it, vi } from "vitest";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { channelNotificationSet } from "./channelNotificationSet.js";

describe("channelNotificationSet", () => {
  it("sets notification level ALL and clears mute state", async () => {
    const update = vi.fn().mockResolvedValue({
      id: "member-1",
      notificationLevel: "ALL",
      muteForever: false,
      muteUntil: null
    });

    const context = {
      db: {
        chatMember: {
          findFirst: vi.fn().mockResolvedValue({ id: "member-1" }),
          update
        }
      }
    } as unknown as ApiContext;

    const membership = await channelNotificationSet(context, {
      organizationId: "org-1",
      channelId: "chat-1",
      userId: "user-1",
      level: "ALL"
    });

    expect(membership.notificationLevel).toBe("ALL");
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: {
        notificationLevel: "ALL",
        muteForever: false,
        muteUntil: null
      }
    }));
  });

  it("sets MENTIONS_ONLY and clears mute state", async () => {
    const update = vi.fn().mockResolvedValue({
      id: "member-1",
      notificationLevel: "MENTIONS_ONLY",
      muteForever: false,
      muteUntil: null
    });

    const context = {
      db: {
        chatMember: {
          findFirst: vi.fn().mockResolvedValue({ id: "member-1" }),
          update
        }
      }
    } as unknown as ApiContext;

    const membership = await channelNotificationSet(context, {
      organizationId: "org-1",
      channelId: "chat-1",
      userId: "user-1",
      level: "MENTIONS_ONLY"
    });

    expect(membership.notificationLevel).toBe("MENTIONS_ONLY");
  });

  it("sets MUTED with muteUntil", async () => {
    const muteUntil = Date.now() + 60_000;
    const update = vi.fn().mockResolvedValue({
      id: "member-1",
      notificationLevel: "MUTED",
      muteForever: false,
      muteUntil: new Date(muteUntil)
    });

    const context = {
      db: {
        chatMember: {
          findFirst: vi.fn().mockResolvedValue({ id: "member-1" }),
          update
        }
      }
    } as unknown as ApiContext;

    const membership = await channelNotificationSet(context, {
      organizationId: "org-1",
      channelId: "chat-1",
      userId: "user-1",
      level: "MUTED",
      muteUntil
    });

    expect(membership.muteForever).toBe(false);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        muteForever: false
      })
    }));
  });

  it("sets MUTED forever when muteUntil is omitted", async () => {
    const update = vi.fn().mockResolvedValue({
      id: "member-1",
      notificationLevel: "MUTED",
      muteForever: true,
      muteUntil: null
    });

    const context = {
      db: {
        chatMember: {
          findFirst: vi.fn().mockResolvedValue({ id: "member-1" }),
          update
        }
      }
    } as unknown as ApiContext;

    const membership = await channelNotificationSet(context, {
      organizationId: "org-1",
      channelId: "chat-1",
      userId: "user-1",
      level: "MUTED"
    });

    expect(membership.muteForever).toBe(true);
    expect(membership.muteUntil).toBeNull();
  });
});
