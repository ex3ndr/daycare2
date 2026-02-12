import { updatesChannelCreate } from "./updatesChannelCreate.js";

export function updatesEphemeralChannelCreate(userId: string): string {
  return updatesChannelCreate(userId);
}
