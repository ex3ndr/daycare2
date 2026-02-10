import { mockServerCreate, type MockServer } from "./mockServerCreate";

type MockGlobal = typeof globalThis & {
  __daycareMockServer__?: MockServer;
};

export function mockServerSingletonGet(): MockServer {
  const globalMock = globalThis as MockGlobal;
  if (!globalMock.__daycareMockServer__) {
    globalMock.__daycareMockServer__ = mockServerCreate();
  }
  return globalMock.__daycareMockServer__;
}
