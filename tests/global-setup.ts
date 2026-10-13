// Starts a throwaway PostgreSQL (embedded binaries) unless TEST_DATABASE_URL
// is given, then applies the real migrations.
import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import EmbeddedPostgres from "embedded-postgres";

export default async function () {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://peake:peake@localhost:54329/peake";
  let pg: EmbeddedPostgres | undefined;
  if (!process.env.TEST_DATABASE_URL) {
    rmSync(".testdb", { recursive: true, force: true });
    pg = new EmbeddedPostgres({
      databaseDir: ".testdb", user: "peake", password: "peake", port: 54329, persistent: false,
      initdbFlags: ["--encoding=UTF8", "--locale=C"], onLog: () => {},
    });
    await pg.initialise();
    await pg.start();
    await pg.createDatabase("peake");
  }
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "ignore",
  });
  return async () => { await pg?.stop(); };
}
