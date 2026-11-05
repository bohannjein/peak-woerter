import { describe, expect, it } from "vitest";
import pkg from "../package.json";
import { APP_VERSION, CHANGELOG, compareVersions, unseenReleases } from "@/lib/changelog";

describe("Versionen und Was ist neu", () => {
  it("die neueste Version im Changelog ist die aus package.json", () => {
    expect(APP_VERSION).toBe(pkg.version);
  });

  it("Changelog ist absteigend sortiert, ohne doppelte Versionen, jede mit Inhalt", () => {
    for (let i = 1; i < CHANGELOG.length; i++) expect(compareVersions(CHANGELOG[i - 1].version, CHANGELOG[i].version)).toBe(1);
    for (const r of CHANGELOG) {
      expect(r.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(r.items.length).toBeGreaterThan(0);
    }
  });

  it("vergleicht Zahl für Zahl, nicht als Text", () => {
    expect(compareVersions("1.10.0", "1.9.9")).toBe(1);
    expect(compareVersions("1.1.3", "1.2.0")).toBe(-1);
    expect(compareVersions("1.2", "1.2.0")).toBe(0);
  });

  it("zeigt nur, was neuer ist als das zuletzt Gesehene", () => {
    expect(unseenReleases("1.1.3").map((r) => r.version)).toEqual(["1.2.1", "1.2.0"]);
    expect(unseenReleases(APP_VERSION)).toEqual([]);
  });
});
