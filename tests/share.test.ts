import { describe, expect, it } from "vitest";
import { TEST_URL, db, setup } from "./helpers";
import { castVote } from "@/lib/voting";
import { submitWord } from "@/lib/words";
import { checkShareKey, shareKey } from "@/lib/share";

describe("Teilen-Link", () => {
  it("akzeptiert nur den Schlüssel des eigenen Slugs", () => {
    const k = shareKey("mumpitz", "geheim");
    expect(checkShareKey("mumpitz", k, "geheim")).toBe(true);
    expect(checkShareKey("firlefanz", k, "geheim")).toBe(false);
    expect(checkShareKey("mumpitz", k, "anderes-secret")).toBe(false);
    expect(checkShareKey("mumpitz", undefined, "geheim")).toBe(false);
    expect(checkShareKey("mumpitz", "kurz", "geheim")).toBe(false);
  });

  it("rendert die Karte als PNG in beiden Formaten, nur mit gültigem Schlüssel", async () => {
    process.env.DATABASE_URL = TEST_URL; // the app's lazy db client
    const u = await setup();
    const w = await submitWord(db, { term: "Kuddelmuddel", userId: u.a });
    await castVote(db, { wordId: w.id, userId: u.a, value: "YES" });
    await castVote(db, { wordId: w.id, userId: u.b, value: "YES" });
    const { GET } = await import("@/app/api/karte/[slug]/route");
    const call = (q: string) => GET(new Request(`http://x/api/karte/${w.slug}${q}`), { params: Promise.resolve({ slug: w.slug }) });

    const size = async (res: Response) => {
      const b = Buffer.from(await res.arrayBuffer());
      return [b.readUInt32BE(16), b.readUInt32BE(20)]; // PNG IHDR width/height
    };
    const portrait = await call(`?k=${shareKey(w.slug)}`);
    expect(portrait.headers.get("content-type")).toBe("image/png");
    expect(await size(portrait)).toEqual([1080, 1350]);
    expect(await size(await call(`?k=${shareKey(w.slug)}&f=og`))).toEqual([1200, 630]);
    expect((await call("?k=falsch")).status).toBe(404);
  }, 90_000); // first render loads the image engine (slow on a cold start)
});

describe("Teilen-Link-Version", () => {
  it("ändert sich mit dem Karteninhalt, nicht bei gleichem Inhalt", async () => {
    const { shareUrl } = await import("@/lib/share");
    const a = shareUrl("mumpitz", { term: "Mumpitz", definition: "Unsinn." });
    expect(a).toMatch(/\/teilen\/mumpitz\?k=[0-9a-f]{16}&v=[0-9a-f]{8}$/);
    expect(shareUrl("mumpitz", { term: "Mumpitz", definition: "Unsinn." })).toBe(a);
    expect(shareUrl("mumpitz", { term: "Mumpitz", definition: "Quatsch." })).not.toBe(a);
  });
});
