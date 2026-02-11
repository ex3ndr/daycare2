import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createId } from "@paralleldrive/cuid2";
import { databaseConnect } from "@/modules/database/databaseConnect.js";
import { databaseCreate } from "@/modules/database/databaseCreate.js";
import { testDatabaseReset } from "./testDatabaseReset.js";

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("testDatabaseReset.spec.ts requires DATABASE_URL or TEST_DATABASE_URL");
}

describe("testDatabaseReset", () => {
  let db: PrismaClient;

  beforeAll(async () => {
    db = databaseCreate(databaseUrl);
    await databaseConnect(db);
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("truncates core tables", async () => {
    await db.organization.create({
      data: {
        id: createId(),
        slug: "acme",
        name: "Acme"
      }
    });

    await testDatabaseReset(db);

    const organizations = await db.organization.findMany();
    expect(organizations).toHaveLength(0);
  });
});
