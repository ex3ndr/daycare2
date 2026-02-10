import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaClientMock = vi.fn();

vi.mock("@prisma/client", () => ({
  PrismaClient: prismaClientMock
}));

describe("databaseCreate", () => {
  beforeEach(() => {
    prismaClientMock.mockReset();
  });

  it("creates prisma client with explicit datasource url", async () => {
    const client = { id: "db-client" };
    prismaClientMock.mockImplementation(() => client);

    const { databaseCreate } = await import("./databaseCreate.js");
    const result = databaseCreate("postgresql://localhost:5432/daycare");

    expect(prismaClientMock).toHaveBeenCalledWith({
      datasources: {
        db: {
          url: "postgresql://localhost:5432/daycare"
        }
      }
    });
    expect(result).toBe(client);
  });
});
