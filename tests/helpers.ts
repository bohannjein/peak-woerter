import { randomUUID } from "node:crypto";
import { createDb } from "@/lib/db";

export const TEST_URL = process.env.TEST_DATABASE_URL ?? "postgresql://peake:peake@localhost:54329/peake";
export const db = createDb(TEST_URL);

export async function resetDb() {
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
}

export async function makeUser(name: string, opts: { seat?: number; admin?: boolean } = {}) {
  const id = randomUUID();
  await db.user.create({ data: { id, name, email: `${name.toLowerCase()}@example.test`, isAdmin: !!opts.admin } });
  if (opts.seat) await db.curatorSeat.create({ data: { seat: opts.seat, userId: id } });
  return id;
}

export async function setup() {
  await resetDb();
  const a = await makeUser("Anna", { seat: 1, admin: true });
  const b = await makeUser("Ben", { seat: 2 });
  const admin = await makeUser("Admin", { admin: true });
  const outsider = await makeUser("Gast");
  return { a, b, admin, outsider };
}
