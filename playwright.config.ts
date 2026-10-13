import { defineConfig, devices } from "@playwright/test";

// End-to-end tests against a running instance with an EMPTY database and
// SETUP_TOKEN=test-setup-token (see README, "Tests").
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  workers: 1,
  use: {
    baseURL: process.env.E2E_URL ?? "http://localhost:3000",
    channel: process.env.PW_CHANNEL || undefined, // e.g. "msedge" or "chrome" to use an installed browser
    locale: "de-DE",
    timezoneId: "Europe/Berlin",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "mobile", use: { ...devices["Pixel 7"], channel: process.env.PW_CHANNEL || undefined } }],
});
