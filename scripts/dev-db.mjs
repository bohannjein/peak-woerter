// Local development/test PostgreSQL without Docker (uses the embedded-postgres binaries).
// Usage: node scripts/dev-db.mjs [port] [dir]
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";

const port = Number(process.argv[2] ?? 5433);
const dir = process.argv[3] ?? ".devdb";
const pg = new EmbeddedPostgres({ databaseDir: dir, user: "peake", password: "peake", port, persistent: true,
  initdbFlags: ["--encoding=UTF8", "--locale=C"] });
if (!existsSync(dir)) {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("peake");
} else {
  await pg.start();
}
console.log(`PostgreSQL läuft: postgresql://peake:peake@localhost:${port}/peake`);
const stop = async () => { await pg.stop(); process.exit(0); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
