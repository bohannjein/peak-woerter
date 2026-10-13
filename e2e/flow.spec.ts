import { expect, test, type Page, type BrowserContext } from "@playwright/test";

// One continuous story on a phone viewport: setup → invite → submit → swipe vote
// by both curators → word is public → visitor cannot vote.
const PW = "korrekt-pferd-batterie-heftklammer";
const shots = process.env.E2E_SHOTS; // optional directory for screenshots

async function shot(page: Page, name: string) {
  if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: false });
}

test.describe.configure({ mode: "serial" });

let anna: BrowserContext;
let ben: BrowserContext;
let inviteLink = "";

test("Ersteinrichtung mit Setup-Token", async ({ browser }) => {
  anna = await browser.newContext();
  const p = await anna.newPage();
  await p.goto("/");
  await expect(p).toHaveURL(/einrichtung/);
  await shot(p, "01-setup");
  await p.getByLabel("Setup-Token").fill("falsch");
  await p.getByLabel("Dein Name").fill("Anna");
  await p.getByLabel("E-Mail").fill("anna@example.test");
  await p.getByLabel("Passwort", { exact: true }).fill(PW);
  await p.getByLabel("Passwort wiederholen").fill(PW);
  await p.getByRole("button", { name: "Konto anlegen" }).click();
  await expect(p.getByText("Setup-Token ist ungültig.")).toBeVisible();

  await p.getByLabel("Setup-Token").fill(process.env.E2E_SETUP_TOKEN ?? "test-setup-token");
  await p.getByLabel("Passwort", { exact: true }).fill(PW);
  await p.getByLabel("Passwort wiederholen").fill(PW);
  await p.getByRole("button", { name: "Konto anlegen" }).click();
  await expect(p.getByRole("heading", { name: "Konto absichern" })).toBeVisible();
  await p.getByRole("link", { name: "Weiter" }).click();

  await expect(p.getByRole("heading", { name: "Kurator einladen" })).toBeVisible();
  await p.getByRole("button", { name: "Einladungslink erstellen" }).click();
  inviteLink = (await p.locator("p.font-mono").textContent())!.trim();
  expect(inviteLink).toContain("/einladung/");
  await p.getByRole("link", { name: /weiter/i }).click();

  await p.getByRole("button", { name: "Speichern und weiter" }).click();
  await p.getByRole("button", { name: "Einrichtung abschließen" }).click();
  await expect(p).toHaveURL(/\/k$/);
  await expect(p.getByRole("heading", { name: "Hallo Anna." })).toBeVisible();

  // Setup is locked now.
  await p.goto("/einrichtung");
  await expect(p.getByRole("heading", { name: "Schon eingerichtet." })).toBeVisible();
});

test("zweiter Kurator nimmt Einladung an", async ({ browser }) => {
  ben = await browser.newContext();
  const p = await ben.newPage();
  await p.goto(new URL(inviteLink).pathname);
  await p.getByLabel("Dein Name").fill("Ben");
  await p.getByLabel("E-Mail").fill("ben@example.test");
  await p.getByLabel("Passwort", { exact: true }).fill(PW);
  await p.getByLabel("Passwort wiederholen").fill(PW);
  await p.getByRole("button", { name: "Konto anlegen" }).click();
  await expect(p).toHaveURL(/konto/);
  // Link is single-use.
  const again = await ben.newPage();
  await again.goto(new URL(inviteLink).pathname);
  await expect(again.getByRole("heading", { name: "Link ungültig." })).toBeVisible();
});

test("Wort in Sekunden einreichen, Duplikat wird erkannt", async () => {
  const p = await anna.newPage();
  await p.goto("/k/neu");
  await shot(p, "02-neu");
  await p.getByPlaceholder("z. B. Kladderadatsch").fill("Mumpitz");
  await p.getByRole("button", { name: "Hinzufügen", exact: true }).click();
  await expect(p.getByRole("status")).toContainText("„Mumpitz“ hinzugefügt");
  await p.getByPlaceholder("z. B. Kladderadatsch").fill("  mumpitz ");
  await expect(p.locator("#dup")).toContainText("steht schon zur Abstimmung");
  await p.getByPlaceholder("z. B. Kladderadatsch").fill("Firlefanz");
  await p.getByRole("button", { name: "Hinzufügen", exact: true }).click();
  await expect(p.getByRole("status")).toContainText("Firlefanz");
});

test("Ben wischt: rechts = Ja, Button Nein, Rückgängig", async () => {
  const p = await ben.newPage();
  await p.goto("/k/abstimmen");
  await expect(p.getByText("2 Karten im Stapel")).toBeVisible();
  await shot(p, "03-deck");

  // Swipe the top card to the right with touch-like pointer events.
  const card = p.locator("article").first();
  const box = (await card.boundingBox())!;
  const y = box.y + box.height / 2;
  await p.mouse.move(box.x + box.width / 2, y);
  await p.mouse.down();
  for (let i = 1; i <= 10; i++) await p.mouse.move(box.x + box.width / 2 + i * 25, y);
  await p.mouse.up();
  await expect(p.getByRole("status")).toContainText("Ja · „Mumpitz“");

  // Second card: Nein via button, then undo, then Später via keyboard.
  await p.getByRole("button", { name: "Nein", exact: true }).click();
  await p.getByRole("button", { name: "Rückgängig" }).click();
  await expect(p.getByText("1 Karte im Stapel")).toBeVisible();
  await p.keyboard.press("ArrowDown");
  await expect(p.getByText("Stapel leer.")).toBeVisible({ timeout: 10_000 });
  await p.waitForTimeout(4500); // commit window
});

test("Ergebnis: Mumpitz im Archiv, Firlefanz auf der Später-Liste", async () => {
  const p = await anna.newPage();
  await p.goto("/k/abstimmen");
  // Anna voted Ja on submit (default), Ben decided both words already.
  await expect(p.getByText("Stapel leer.")).toBeVisible();
  await p.goto("/k/spaeter");
  await expect(p.getByText("Firlefanz")).toBeVisible();
  await shot(p, "04-spaeter");

  const b = await ben.newPage();
  await b.goto("/woerter");
  await expect(b.getByRole("link", { name: /Mumpitz/ })).toBeVisible();
  await expect(b.getByText("Firlefanz")).toHaveCount(0);
  await b.goto("/wort/mumpitz");
  await expect(b.getByRole("heading", { level: 1, name: "Mumpitz" })).toBeVisible();
  await shot(b, "05-wort");
});

test("Internes Archiv: ohne Anmeldung ist nichts sichtbar", async ({ browser }) => {
  const g = await (await browser.newContext()).newPage();
  for (const url of ["/", "/woerter", "/wort/mumpitz", "/zufall", "/wrapped/2026", "/k/abstimmen", "/konto"]) {
    await g.goto(url);
    await expect(g, url).toHaveURL(/anmelden/);
  }
  await expect(g.getByText("Mumpitz")).toHaveCount(0);
  const r = await g.request.get("/api/export?format=json");
  expect(r.status()).toBe(403);
});

test("Mitglied ohne Stimmrecht: liest, stimmt nicht ab", async ({ browser }) => {
  const a = await anna.newPage();
  await a.goto("/admin/benutzer");
  await a.getByLabel("Kuratorenplatz").selectOption("");
  await a.getByRole("button", { name: "Link erstellen" }).click();
  const link = (await a.locator("form p.font-mono").textContent())!.trim();
  const carla = await browser.newContext();
  const c = await carla.newPage();
  await c.goto(new URL(link).pathname);
  await c.getByLabel("Dein Name").fill("Carla");
  await c.getByLabel("E-Mail").fill("carla@example.test");
  await c.getByLabel("Passwort", { exact: true }).fill(PW);
  await c.getByLabel("Passwort wiederholen").fill(PW);
  await c.getByRole("button", { name: "Konto anlegen" }).click();
  await expect(c).toHaveURL(/konto/);
  await c.goto("/");
  await expect(c.getByRole("heading", { name: "Zuletzt hinzugefügt" })).toBeVisible();
  await expect(c.getByRole("link", { name: "Abstimmen" })).toHaveCount(0);
  await c.goto("/k/abstimmen");
  await expect(c).not.toHaveURL(/abstimmen/);
});

test("Eintrag bearbeiten: Definition und IPA erscheinen im Eintrag", async () => {
  const p = await anna.newPage();
  await p.goto("/k");
  await p.getByRole("link", { name: /Mumpitz/ }).first().click();
  await p.getByRole("link", { name: "Eintrag bearbeiten" }).click();
  await p.getByLabel("Kurzdefinition 1").fill("Unsinn, Quatsch oder eine völlig absurde Behauptung.");
  await p.getByRole("button", { name: "Aussprache hinzufügen" }).click();
  await p.getByLabel("Lautschrift 1").fill("[ˈmʊmpɪt͡s]");
  await p.getByLabel("Beispielsatz 1").fill("Was der da wieder erzählt, ist doch kompletter Mumpitz.");
  await p.getByRole("button", { name: "Speichern" }).click();
  await expect(p.getByRole("status")).toHaveText("Gespeichert.");
  await shot(p, "07-editor");

  const v = await ben.newPage();
  await v.goto("/wort/mumpitz");
  await expect(v.getByText("Unsinn, Quatsch").first()).toBeVisible();
  await expect(v.getByLabel("Lautschrift ˈmʊmpɪt͡s").first()).toBeVisible();
  await shot(v, "08-wort-voll");
});

test("Nachschlagen: Startseite, Suche, Kategorie", async () => {
  const v = await ben.newPage();
  await v.goto("/");
  await expect(v.getByText("Wort des Tages")).toBeVisible();
  await expect(v.getByRole("heading", { name: "Zuletzt hinzugefügt" })).toBeVisible();
  await shot(v, "06-start");
  await v.getByLabel("Wort suchen").fill("quatsch");
  await v.getByRole("button", { name: "Suchen" }).click();
  await expect(v).toHaveURL(/woerter\?q=quatsch/);
  await expect(v.getByRole("link", { name: /Mumpitz/ })).toBeVisible();
  await v.goto("/woerter?q=gibtsnicht");
  await expect(v.getByText("Keine Wörter gefunden")).toBeVisible();

  const a = await anna.newPage();
  await a.goto("/k/kategorien");
  await a.locator("#n-neu").fill("Humor");
  await a.getByRole("button", { name: "Kategorie anlegen" }).click();
  await expect(a.getByText("Humor").first()).toBeVisible();
  await a.goto("/k");
  await a.getByRole("link", { name: /Mumpitz/ }).first().click();
  await a.getByRole("link", { name: "Eintrag bearbeiten" }).click();
  await a.getByRole("button", { name: "Humor" }).click();
  await a.getByRole("button", { name: "Speichern" }).click();
  await expect(a.getByRole("status")).toHaveText("Gespeichert.");
  await v.goto("/woerter");
  await v.getByRole("link", { name: /Humor/ }).click();
  await expect(v).toHaveURL(/kategorie=humor/);
  await expect(v.getByRole("link", { name: /Mumpitz/ })).toBeVisible();
});
