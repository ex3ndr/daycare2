import { describe, expect, it, vi } from "vitest";
import { updatesBroadcast } from "./updatesBroadcast.js";
import { updatesChannelCreate } from "./updatesChannelCreate.js";

describe("updatesBroadcast", () => {
  it("publishes update envelopes to user channel", async () => {
    const publish = vi.fn().mockResolvedValue(1);
    const envelope = {
      id: "update-1",
      userId: "user-1",
      seqno: 1,
      eventType: "message.created",
      payload: { messageId: "m-1" },
      createdAt: 1700000000000
    };

    await updatesBroadcast({ publish }, "user-1", envelope);

    expect(publish).toHaveBeenCalledWith(
      "updates:user-1",
      JSON.stringify(envelope)
    );
  });

  it("supports pub/sub fanout by channel contract", async () => {
    const subscriptions = new Map<string, Array<(message: string) => void>>();
    const publish = vi.fn().mockImplementation(async (channel: string, message: string) => {
      const listeners = subscriptions.get(channel) ?? [];
      listeners.forEach((listener) => {
        listener(message);
      });
      return listeners.length;
    });
    const onMessage = vi.fn();
    const channel = updatesChannelCreate("user-1");
    subscriptions.set(channel, [onMessage]);

    await updatesBroadcast(
      { publish },
      "user-1",
      {
        id: "update-1",
        userId: "user-1",
        seqno: 1,
        eventType: "message.created",
        payload: { messageId: "m-1" },
        createdAt: 1700000000000
      }
    );

    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledTimes(1);
  });
});
