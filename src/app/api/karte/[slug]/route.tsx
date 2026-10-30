import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
import { getPublicEntry } from "@/lib/queries";
import { checkShareKey } from "@/lib/share";
import { POS_LABEL, cardNo } from "@/lib/categories";

// Same values as the .band-* classes in globals.css (Satori cannot read CSS variables).
const BAND: Record<string, [string, string]> = {
  cobalt: ["#2347d8", "#ffffff"],
  sun: ["#ffcf1f", "#231b00"],
  grass: ["#17824b", "#ffffff"],
  magenta: ["#c72663", "#ffffff"],
  orange: ["#f2711c", "#1f0e00"],
  teal: ["#0b7476", "#ffffff"],
  violet: ["#6b46c1", "#ffffff"],
  ink: ["#2a2e3c", "#f4f3ec"],
};

/** The word card as PNG for sharing. Portrait by default, ?f=og for link previews. */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sp = new URL(req.url).searchParams;
  if (!checkShareKey(slug, sp.get("k"))) return new Response("Nicht gefunden.", { status: 404 });
  const w = await getPublicEntry(db, slug);
  if (!w) return new Response("Nicht gefunden.", { status: 404 });

  const og = sp.get("f") === "og";
  const [width, height] = og ? [1200, 630] : [1080, 1350];
  const cat = w.categories[0]?.category;
  const [band, bandInk] = BAND[cat?.color ?? "ink"] ?? BAND.ink;
  const definition = w.definitions[0]?.text;
  const example = og ? null : w.examples[0]?.text;
  // Fit the longest word of the term into the card width (~0.6em per glyph in the default font).
  const longest = Math.max(...w.term.split(/\s+/).map((p) => p.length), 4);
  const termSize = Math.floor(Math.min(og ? 120 : 150, (og ? 1040 : 840) / (longest * 0.6)));
  const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", padding: og ? 40 : 60, background: "#e4e7ee" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#fdfdf8", borderRadius: 40, overflow: "hidden", color: "#13151d", boxShadow: "0 20px 50px -20px rgba(18,20,28,0.45)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: band, color: bandInk, padding: og ? "18px 40px" : "26px 56px", fontSize: og ? 26 : 34, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase" }}>
            <span>{cat?.name ?? "Peake Wörter"}</span>
            <span>{cardNo(w.cardNumber) ?? ""}</span>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: og ? "flex-start" : "center", padding: og ? "32px 40px" : "56px 56px", gap: og ? 14 : 28 }}>
            <div style={{ display: "flex", fontSize: termSize, fontWeight: 800, lineHeight: 1.02, letterSpacing: -2 }}>{w.term}</div>
            {w.partOfSpeech && <div style={{ display: "flex", fontSize: og ? 28 : 36, color: "#4f5466", fontStyle: "italic" }}>{POS_LABEL[w.partOfSpeech]}</div>}
            {definition && <div style={{ display: "flex", fontSize: og ? 34 : 46, lineHeight: 1.3 }}>{clip(definition, og ? 140 : 260)}</div>}
            {example && <div style={{ display: "flex", fontSize: og ? 28 : 38, lineHeight: 1.35, color: "#4f5466", fontStyle: "italic" }}>„{clip(example, 180)}“</div>}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: og ? "0 40px 26px" : "0 56px 44px", fontSize: og ? 24 : 30, color: "#4f5466", fontWeight: 700 }}>
            <span>Peake Wörter</span>
          </div>
        </div>
      </div>
    ),
    { width, height, headers: { "cache-control": "public, max-age=3600" } },
  );
}
