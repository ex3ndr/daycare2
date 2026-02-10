import type { Prisma, PrismaClient } from "@prisma/client";

type TransactionHandler<T> = (tx: Prisma.TransactionClient) => Promise<T>;

export async function databaseTransactionRun<T>(
  db: PrismaClient,
  handler: TransactionHandler<T>
): Promise<T> {
  if (typeof db.$transaction !== "function") {
    throw new Error("Database client does not support $transaction");
  }

  return db.$transaction(handler);
}
