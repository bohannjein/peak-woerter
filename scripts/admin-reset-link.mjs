// Break-glass recovery for when no administrator can log in.
// Requires shell access to the server (that is the trust anchor).
//
//   docker compose exec app node scripts/admin-reset-link.mjs <email> [--reset-2fa]
//
// Prints a one-time password reset link (valid 24 h). --reset-2fa also removes
// TOTP and recovery codes; an active 2FA/passkey policy then forces the user to
// set them up again right after logging in.
import { createHash, randomBytes, randomUUID } from "node:crypto";
import pg from "pg";

const [email, flag] = process.argv.slice(2);
if (!email) {
  console.error("Aufruf: node scripts/admin-reset-link.mjs <email> [--reset-2fa]");
  process.exit(1);
}
const client = new pg.Client(process.env.DATABASE_URL);
await client.connect();
try {
  const { rows } = await client.query(`SELECT id, name FROM "user" WHERE email = $1`, [email.trim().toLowerCase()]);
  if (!rows[0]) throw new Error(`Kein Konto mit ${email}.`);
  const user = rows[0];
  const token = randomBytes(32).toString("base64url");
  await client.query("BEGIN");
  await client.query(
    `INSERT INTO access_link (id, kind, "tokenHash", "userId", "expiresAt") VALUES ($1, 'RESET', $2, $3, now() + interval '24 hours')`,
    [randomUUID(), createHash("sha256").update(token).digest("hex"), user.id],
  );
  if (flag === "--reset-2fa") {
    await client.query(`DELETE FROM "twoFactor" WHERE "userId" = $1`, [user.id]);
    await client.query(`UPDATE "user" SET "twoFactorEnabled" = false WHERE id = $1`, [user.id]);
  }
  await client.query(`INSERT INTO audit_log (id, action, "entityType", "entityId", data) VALUES ($1, 'cli.reset_link', 'user', $2, $3)`, [
    randomUUID(),
    user.id,
    JSON.stringify({ reset2fa: flag === "--reset-2fa" }),
  ]);
  await client.query("COMMIT");
  const base = (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
  console.log(`Link für ${user.name} (24 h gültig, einmalig):\n${base}/zuruecksetzen/${token}`);
} catch (e) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await client.end();
}
