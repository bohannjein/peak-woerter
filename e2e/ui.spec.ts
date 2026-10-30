import { expect, test, type Browser } from "@playwright/test";

// Runs after flow.spec.ts (alphabetical, one worker) and reuses its accounts.
const PW = "korrekt-pferd-batterie-heftklammer";

async function signedIn(browser: Browser, email: string) {
  const ctx = await browser.newContext();
  const r = await ctx.request.post("/api/auth/sign-in/email", { data: { email, password: PW }, headers: { origin: test.info().project.use.baseURL! } });
  expect(r.ok()).toBeTruthy();
  return ctx;
}

test("Menü: Tippen daneben schließt nur das Menü", async ({ browser }) => {
  const p = await (await signedIn(browser, "anna@example.test")).newPage();
  await p.goto("/woerter");
  await p.getByRole("button", { name: /^Menü/ }).click();
  const menu = p.getByRole("navigation", { name: "Weitere Bereiche" });
  await expect(menu).toBeVisible();
  // Left edge, where the word list (links) sits underneath the backdrop.
  await p.mouse.click(20, 400);
  await expect(menu).toBeHidden();
  await expect(p).toHaveURL(/\/woerter$/);
});

test("Entwurf wandert auf ein anderes Gerät", async ({ browser }) => {
  const phone = await (await signedIn(browser, "anna@example.test")).newPage();
  await phone.goto("/k/neu");
  await phone.getByPlaceholder("Wort eingeben").fill("Schnickschnack");
  await phone.waitForTimeout(2600); // server copy is written after 2 s

  const laptop = await (await signedIn(browser, "anna@example.test")).newPage();
  await laptop.goto("/k/neu");
  await expect(laptop.getByText("Ungespeicherter Entwurf")).toBeVisible();
  await laptop.getByRole("button", { name: "Wiederherstellen" }).click();
  await expect(laptop.getByPlaceholder("Wort eingeben")).toHaveValue("Schnickschnack");

  // Submitting removes the draft everywhere.
  await laptop.getByRole("button", { name: "Hinzufügen", exact: true }).click();
  await expect(laptop.getByText("„Schnickschnack“ hinzugefügt")).toBeVisible();
  const tablet = await (await signedIn(browser, "anna@example.test")).newPage();
  await tablet.goto("/k/neu");
  await tablet.waitForTimeout(1000);
  await expect(tablet.getByText("Ungespeicherter Entwurf")).toHaveCount(0);
});
