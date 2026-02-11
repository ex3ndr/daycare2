import { redisConnect } from "./redisConnect.js";
import { redisCreate } from "./redisCreate.js";

export type RedisPubSub = {
  pub: {
    publish: (channel: string, message: string) => Promise<number>;
  };
  sub: {
    subscribe: (...channels: string[]) => Promise<unknown>;
    unsubscribe: (...channels: string[]) => Promise<unknown>;
    on: (event: "message", listener: (channel: string, message: string) => void) => unknown;
    off: (event: "message", listener: (channel: string, message: string) => void) => unknown;
  };
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
};

export function redisPubSubCreate(redisUrl: string): RedisPubSub {
  const pubClient = redisCreate(redisUrl);
  const subClient = redisCreate(redisUrl);

  return {
    pub: {
      publish: async (channel: string, message: string) => {
        return await pubClient.publish(channel, message);
      }
    },
    sub: {
      subscribe: async (...channels: string[]) => {
        return await subClient.subscribe(...channels);
      },
      unsubscribe: async (...channels: string[]) => {
        return await subClient.unsubscribe(...channels);
      },
      on: (event: "message", listener: (channel: string, message: string) => void) => {
        subClient.on(event, listener);
      },
      off: (event: "message", listener: (channel: string, message: string) => void) => {
        subClient.off(event, listener);
      }
    },
    connect: async () => {
      await Promise.all([redisConnect(pubClient), redisConnect(subClient)]);
    },
    disconnect: async () => {
      await Promise.allSettled([
        subClient.unsubscribe(),
        subClient.quit(),
        pubClient.quit()
      ]);
    }
  };
}
