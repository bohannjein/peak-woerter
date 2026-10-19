import { beforeEach, describe, expect, it } from "vitest";
import { verifyPassword } from "better-auth/crypto";
import { db, makeUser, resetDb } from "./helpers";
import {
  acceptInvite, checkSetupToken, createInitialAdmin, createInvite, createResetLink, ensureSetupToken,
  peekLink, resetPassword, resetSecondFactor,
} from "@/lib/accounts";
import { getSettings, setSettings } from "@/lib/settings";
import { policyGaps } from "@/lib/policy";

beforeEach(async () => {
  await resetDb();
  delete process.env.SETUP_TOKEN;
});

const PW = "korrekt-pferd-batterie";

describe("Ersteinrichtung", () => {
  it("braucht das Setup-Token und ist danach gesperrt", async () => {
    process.env.SETUP_TOKEN = "geheim-123";
    await expect(createInitialAdmin(db, { token: "falsch", name: "A", email: "a@x.de", password: PW, asCurator: true })).rejects.toThrow(/ungültig/);
    const admin = await createInitialAdmin(db, { token: "geheim-123", name: "Anna", email: "A@X.de", password: PW, asCurator: true });
    expect(admin).toMatchObject({ isAdmin: true, email: "a@x.de" });
    expect(await db.curatorSeat.findUnique({ where: { seat: 1 } })).toMatchObject({ userId: admin.id });
    const acc = await db.account.findFirstOrThrow({ where: { userId: admin.id } });
    expect(await verifyPassword({ hash: acc.password!, password: PW })).toBe(true);
    await expect(createInitialAdmin(db, { token: "geheim-123", name: "B", email: "b@x.de", password: PW, asCurator: false })).rejects.toThrow(/bereits/);
  });

  it("generiertes Token wird nur gehasht gespeichert", async () => {
    await ensureSetupToken(db);
    const s = await getSettings(db);
    expect(s.setupTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(await checkSetupToken(db, "irgendwas")).toBe(false);
  });

  it("schwache Passwörter werden abgelehnt", async () => {
    process.env.SETUP_TOKEN = "t";
    await expect(createInitialAdmin(db, { token: "t", name: "A", email: "a@x.de", password: "kurz", asCurator: false })).rejects.toThrow(/12 Zeichen/);
    await expect(createInitialAdmin(db, { token: "t", name: "A", email: "a@x.de", password: "aaaaaaaaaaaaaa", asCurator: false })).rejects.toThrow(/einfach/);
  });
});

describe("Einladungen", () => {
  it("erzeugt Kurator mit Sitz, einmalig verwendbar", async () => {
    const admin = await makeUser("Admin", { admin: true, seat: 1 });
    const token = await createInvite(db, { createdById: admin, email: "ben@x.de", grantAdmin: false, grantSeat: 2 });
    expect(await peekLink(db, token, "INVITE")).not.toBeNull();
    await expect(acceptInvite(db, { token, name: "Eve", email: "eve@x.de", password: PW })).rejects.toThrow(/andere E-Mail/);
    const ben = await acceptInvite(db, { token, name: "Ben", email: "ben@x.de", password: PW });
    expect(await db.curatorSeat.findUnique({ where: { seat: 2 } })).toMatchObject({ userId: ben.id });
    expect(ben.isAdmin).toBe(false);
    await expect(acceptInvite(db, { token, name: "Ben2", email: "ben@x.de", password: PW })).rejects.toThrow(/ungültig oder abgelaufen/);
  });

  it("es gibt höchstens so viele Kuratorensitze wie Voter eingestellt sind", async () => {
    await makeUser("A", { seat: 1 });
    await makeUser("B", { seat: 2 });
    const c = await makeUser("C");
    await expect(db.curatorSeat.create({ data: { seat: 0, userId: c } })).rejects.toThrow();
    await expect(createInvite(db, { createdById: c, grantAdmin: false, grantSeat: 2 })).rejects.toThrow(/vergeben/);
    await expect(createInvite(db, { createdById: c, grantAdmin: false, grantSeat: 3 })).rejects.toThrow(/Ungültiger Platz/);
    await setSettings(db, { voterCount: 3 });
    await createInvite(db, { createdById: c, grantAdmin: false, grantSeat: 3 });
  });

  it("abgelaufene Einladungen gelten nicht", async () => {
    const admin = await makeUser("Admin", { admin: true });
    const token = await createInvite(db, { createdById: admin, grantAdmin: false, grantSeat: 1 });
    await db.accessLink.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(acceptInvite(db, { token, name: "X", email: "x@x.de", password: PW })).rejects.toThrow(/abgelaufen/);
  });
});

describe("Recovery", () => {
  it("Passwort-Reset ändert Passwort, beendet Sitzungen, lässt 2FA bestehen", async () => {
    const u = await makeUser("Ben", { seat: 2 });
    await db.user.update({ where: { id: u }, data: { twoFactorEnabled: true } });
    await db.twoFactor.create({ data: { id: "tf1", userId: u, secret: "s", backupCodes: "b" } });
    await db.session.create({ data: { id: "s1", userId: u, token: "tok", expiresAt: new Date(Date.now() + 1e6) } });
    const token = await createResetLink(db, { createdById: null, userId: u });
    await resetPassword(db, { token, password: PW });
    expect(await db.session.count({ where: { userId: u } })).toBe(0);
    expect((await db.user.findUniqueOrThrow({ where: { id: u } })).twoFactorEnabled).toBe(true);
    await expect(resetPassword(db, { token, password: PW })).rejects.toThrow();
  });

  it("2FA-Reset durch Admin erzwingt Neueinrichtung über die Richtlinie", async () => {
    const admin = await makeUser("Admin", { admin: true });
    const u = await makeUser("Ben", { seat: 2 });
    await db.user.update({ where: { id: u }, data: { twoFactorEnabled: true } });
    await setSettings(db, { require2fa: true });
    await resetSecondFactor(db, { adminId: admin, userId: u });
    const user = await db.user.findUniqueOrThrow({ where: { id: u } });
    expect(policyGaps(await getSettings(db), { has2fa: !!user.twoFactorEnabled, passkeys: 0 })).toEqual(["2fa"]);
  });
});

describe("Authentifizierungsrichtlinien", () => {
  it("meldet fehlende Pflichtfaktoren", () => {
    const none = { require2fa: false, requirePasskey: false };
    const both = { require2fa: true, requirePasskey: true };
    expect(policyGaps(none, { has2fa: false, passkeys: 0 })).toEqual([]);
    expect(policyGaps(both, { has2fa: false, passkeys: 0 })).toEqual(["2fa", "passkey"]);
    expect(policyGaps(both, { has2fa: true, passkeys: 1 })).toEqual([]);
    expect(policyGaps({ require2fa: false, requirePasskey: true }, { has2fa: true, passkeys: 0 })).toEqual(["passkey"]);
  });
});
