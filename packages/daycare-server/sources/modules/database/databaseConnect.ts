import type { PrismaClient } from "@prisma/client";

export async function databaseConnect(client: PrismaClient): Promise<void> {
  await client.$connect();
}
