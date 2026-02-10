import type { PrismaClient } from "@prisma/client";

export async function databaseDisconnect(client: PrismaClient): Promise<void> {
  await client.$disconnect();
}
