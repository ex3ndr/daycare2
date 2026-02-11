import { describe, expect, it } from "vitest";
import { databaseCreate } from "./databaseCreate.js";

describe("databaseCreate", () => {
  it("creates a prisma client configured with the provided datasource url", async () => {
    const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("databaseCreate.spec.ts requires DATABASE_URL or TEST_DATABASE_URL");
    }

    const client = databaseCreate(databaseUrl);

    expect(typeof client.$connect).toBe("function");
    expect(typeof client.$disconnect).toBe("function");

    await client.$disconnect();
  });
});
