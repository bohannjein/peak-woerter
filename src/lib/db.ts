import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

export type Db = PrismaClient;
export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

export function createDb(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) throw new Error("DATABASE_URL ist nicht gesetzt.");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

const g = globalThis as unknown as { __db?: PrismaClient };
// Lazy so that `next build` works without a database.
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_t, prop) {
    g.__db ??= createDb();
    const v = Reflect.get(g.__db, prop);
    return typeof v === "function" ? v.bind(g.__db) : v;
  },
});
