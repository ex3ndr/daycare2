import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { databaseConnect } from "./databaseConnect.js";

describe("databaseConnect", () => {
  it("calls prisma connect", async () => {
    const connect = vi.fn().mockResolvedValue(undefined);
    const client = {
      $connect: connect
    } as unknown as PrismaClient;

    await databaseConnect(client);

    expect(connect).toHaveBeenCalledTimes(1);
  });
});
