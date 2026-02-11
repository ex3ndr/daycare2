import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { sessionRestore } from "./sessionRestore";
import type { ApiClient } from "@/app/daycare/api/apiClientCreate";
import type { Account, Organization } from "@/app/daycare/types";

function createMockStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    get length() { return store.size; },
    key: (index: number) => [...store.keys()][index] ?? null,
  };
}

const mockAccount: Account = {
  id: "acc_1",
  email: "test@test.com",
  createdAt: 1000,
  updatedAt: 1000,
};

const mockOrg: Organization = {
  id: "org_1",
  slug: "acme",
  name: "Acme",
  avatarUrl: null,
  createdAt: 1000,
  updatedAt: 1000,
};

function createMockApi(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    authLogin: vi.fn(),
    authLogout: vi.fn(),
    meGet: vi.fn().mockResolvedValue({ account: mockAccount, organizations: [mockOrg] }),
    organizationAvailableList: vi.fn(),
    organizationCreate: vi.fn(),
    organizationJoin: vi.fn(),
    organizationGet: vi.fn(),
    organizationMembers: vi.fn(),
    profileGet: vi.fn(),
    profilePatch: vi.fn(),
    channelList: vi.fn(),
    channelCreate: vi.fn(),
    channelJoin: vi.fn(),
    channelLeave: vi.fn(),
    channelMembers: vi.fn(),
    messageList: vi.fn(),
    messageSend: vi.fn(),
    messageEdit: vi.fn(),
    messageDelete: vi.fn(),
    messageReactionAdd: vi.fn(),
    messageReactionRemove: vi.fn(),
    typingUpsert: vi.fn(),
    typingList: vi.fn(),
    readStateSet: vi.fn(),
    readStateGet: vi.fn(),
    updatesDiff: vi.fn(),
    updatesStreamSubscribe: vi.fn(),
    ...overrides,
  } as ApiClient;
}

describe("sessionRestore", () => {
  let origStorage: Storage;

  beforeEach(() => {
    origStorage = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", {
      value: createMockStorage(),
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      value: origStorage,
      writable: true,
      configurable: true,
    });
  });

  it("returns 'none' when no session is stored", async () => {
    const api = createMockApi();
    const result = await sessionRestore(api);
    expect(result).toEqual({ status: "none" });
    expect(api.meGet).not.toHaveBeenCalled();
  });

  it("returns 'restored' with session data when token is valid", async () => {
    localStorage.setItem("daycare:session", JSON.stringify({ token: "tok_valid", accountId: "acc_1" }));
    const api = createMockApi();
    const result = await sessionRestore(api);
    expect(result).toEqual({
      status: "restored",
      session: { token: "tok_valid", accountId: "acc_1" },
      account: mockAccount,
      organizations: [mockOrg],
    });
    expect(api.meGet).toHaveBeenCalledWith("tok_valid");
  });

  it("returns 'expired' and clears session when token is invalid", async () => {
    localStorage.setItem("daycare:session", JSON.stringify({ token: "tok_expired", accountId: "acc_1" }));
    const api = createMockApi({
      meGet: vi.fn().mockRejectedValue(new Error("Unauthorized")),
    });
    const result = await sessionRestore(api);
    expect(result).toEqual({ status: "expired" });
    expect(localStorage.getItem("daycare:session")).toBeNull();
  });

  it("returns 'none' when localStorage contains corrupt data", async () => {
    localStorage.setItem("daycare:session", "not-json");
    const api = createMockApi();
    const result = await sessionRestore(api);
    expect(result).toEqual({ status: "none" });
    expect(api.meGet).not.toHaveBeenCalled();
  });

  it("returns 'none' when session data has missing fields", async () => {
    localStorage.setItem("daycare:session", JSON.stringify({ token: "tok" }));
    const api = createMockApi();
    const result = await sessionRestore(api);
    expect(result).toEqual({ status: "none" });
    expect(api.meGet).not.toHaveBeenCalled();
  });

  it("clears session on network error", async () => {
    localStorage.setItem("daycare:session", JSON.stringify({ token: "tok_net", accountId: "acc_1" }));
    const api = createMockApi({
      meGet: vi.fn().mockRejectedValue(new Error("Network error")),
    });
    const result = await sessionRestore(api);
    expect(result).toEqual({ status: "expired" });
    expect(localStorage.getItem("daycare:session")).toBeNull();
  });
});
