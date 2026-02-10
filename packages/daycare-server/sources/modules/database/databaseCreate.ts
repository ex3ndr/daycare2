import { PrismaClient } from "@prisma/client";

export function databaseCreate(databaseUrl: string): PrismaClient {
  return new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl
      }
    }
  });
}
