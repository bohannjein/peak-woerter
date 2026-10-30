import { expect, test, type Browser, type BrowserContext } from "@playwright/test";

// Runs after flow.spec.ts (alphabetical, one worker) and reuses its accounts.
const PW = "korrekt-pferd-batterie-heftklammer";

// Sign in once (the sign-in endpoint is rate limited) and reuse the session for every "device".
let session: Awaited<ReturnType<BrowserContext["storageState"]>>;
test.beforeAll(async ({ browser }) => {
  const ctx = await browser.newContext();
  const r = await ctx.request.post("/api/auth/sign-in/email", { data: { email: "anna@example.test", password: PW }, headers: { origin: test.info().project.use.baseURL! } });
  expect(r.ok()).toBeTruthy();
  session = await ctx.storageState();
  await ctx.close();
});

const signedIn = (browser: Browser) => browser.newContext({ storageState: session });

test("Menü: Tippen daneben schließt nur das Menü", async ({ browser }) => {
  const p = await (await signedIn(browser)).newPage();
  await p.goto("/woerter");
  await p.getByRole("button", { name: /^Menü/ }).click();
  const menu = p.getByRole("navigation", { name: "Weitere Bereiche" });
  await expect(menu).toBeVisible();
  await expect(p.locator("body > div.fixed.inset-0")).toBeVisible(); // backdrop is drawn
  // Left edge, where the word list (links) sits underneath the backdrop.
  await p.mouse.click(20, 400);
  await expect(menu).toBeHidden();
  await expect(p).toHaveURL(/\/woerter$/);
});

test("Entwurf wandert auf ein anderes Gerät", async ({ browser }) => {
  const phone = await (await signedIn(browser)).newPage();
  await phone.goto("/k/neu");
  await phone.getByPlaceholder("Wort eingeben").fill("Schnickschnack");
  await phone.waitForTimeout(2600); // server copy is written after 2 s

  const laptop = await (await signedIn(browser)).newPage();
  await laptop.goto("/k/neu");
  await expect(laptop.getByText("Ungespeicherter Entwurf")).toBeVisible();
  await laptop.getByRole("button", { name: "Wiederherstellen" }).click();
  await expect(laptop.getByPlaceholder("Wort eingeben")).toHaveValue("Schnickschnack");

  // Submitting removes the draft everywhere.
  await laptop.getByRole("button", { name: "Hinzufügen", exact: true }).click();
  await expect(laptop.getByText("„Schnickschnack“ hinzugefügt")).toBeVisible();
  const tablet = await (await signedIn(browser)).newPage();
  await tablet.goto("/k/neu");
  await tablet.waitForTimeout(1000);
  await expect(tablet.getByText("Ungespeicherter Entwurf")).toHaveCount(0);
});

test("Sammlung: Suche grenzt beim Tippen ein, ohne Enter", async ({ browser }) => {
  const p = await (await signedIn(browser)).newPage();
  await p.goto("/woerter");
  const field = p.locator("#suche");
  await field.pressSequentially("mum", { delay: 80 });
  await expect(p).toHaveURL(/woerter\?q=mum$/);
  await expect(p.getByText("Mumpitz", { exact: true })).toBeVisible();
  await field.pressSequentially("x", { delay: 80 });
  await expect(p.getByText("Keine Wörter gefunden")).toBeVisible();
  await expect(field).toBeFocused(); // typing goes on uninterrupted
  await field.fill("");
  await expect(p).toHaveURL(/\/woerter$/);
});

test("Teilen: Link-Vorschau zeigt den Schnappschuss der echten Karte", async ({ browser }) => {
  // Browser without Web Share (like the desktop, and file sharing like Firefox on Android).
  const ctx = await signedIn(browser);
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"]);
  await ctx.addInitScript(() => Object.defineProperty(navigator, "share", { value: undefined }));
  const p = await ctx.newPage();
  await p.goto("/wort/mumpitz");
  const upload = p.waitForResponse((r) => r.request().method() === "PUT" && r.url().includes("/api/karte/mumpitz"));
  await p.getByRole("button", { name: "Teilen" }).click();
  expect((await upload).ok()).toBeTruthy();
  const link = new URL(await p.evaluate(() => navigator.clipboard.readText()));

  // A stranger opening the link: the preview image (og:image) is the uploaded snapshot.
  const anon = await (await browser.newContext()).newPage();
  await anon.goto(link.pathname + link.search);
  const og = await anon.locator('meta[property="og:image"]').getAttribute("content");
  expect(og).toMatch(/&v=[1-9]/);
  const png = Buffer.from(await (await anon.request.get(new URL(og!).pathname + new URL(og!).search)).body());
  // Snapshot: 400 px card at 3x, portrait. Server cards are 1200x630 (preview) or 1080x1350.
  expect(png.readUInt32BE(16)).toBe(1200);
  expect(png.readUInt32BE(20)).toBeGreaterThan(1200);
});
