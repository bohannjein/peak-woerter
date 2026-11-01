import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getAiProvider, listModels, parseSuggestion, userPrompt } from "@/lib/ai";

describe("KI-Antwort", () => {
  it("akzeptiert abweichende Antworten (fehlende Felder, englische Werte, null-Listen, Hülle, Fließtext)", () => {
    const raw = `Hier ist der Eintrag:\n\`\`\`json\n${JSON.stringify({
      Mumpitz: { shortDefinition: "Unsinn.", partOfSpeech: "Noun", ipa: "[ˈmʊmpɪts]", ipaConfidence: "High", categories: null, variants: "Mumpiz, Mumbitz", example: "x".repeat(900) },
    })}\n\`\`\``;
    const s = parseSuggestion(raw);
    expect(s).toMatchObject({ shortDefinition: "Unsinn.", partOfSpeech: "SUBSTANTIV", ipa: "ˈmʊmpɪts", ipaConfidence: "hoch", categories: [], variants: ["Mumpiz", "Mumbitz"], origin: null, caveats: null });
    expect(s.example).toHaveLength(400);
  });
  it("meldet fehlendes JSON", () => {
    expect(() => parseSuggestion("Keine Ahnung.")).toThrow(/JSON/);
  });
});

// Fake OpenAI-compatible server: /ok answers OpenAI-style, /gemini Gemini-style, /auth refuses.
let base = "";
const formats: string[] = [];
const server = createServer(async (req, res) => {
  if (req.url?.startsWith("/auth")) return res.writeHead(401).end();
  if (req.url?.endsWith("/chat/completions")) {
    let raw = "";
    for await (const c of req) raw += c;
    const type = JSON.parse(raw).response_format.type as string;
    formats.push(type);
    // /noschema behaves like a provider without json_schema support.
    if (type === "json_schema" && req.url.startsWith("/noschema")) return res.writeHead(400).end();
    return res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ shortDefinition: "Unsinn." }) } }] }));
  }
  const body = req.url?.startsWith("/gemini") ? { models: [{ name: "models/gemini-x" }] } : { data: [{ id: "b-model" }, { id: "a-model" }], auth: req.headers.authorization };
  res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(body));
});
beforeAll(async () => {
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());

describe("Modellliste", () => {
  it("liest OpenAI- und Gemini-Format, sortiert", async () => {
    expect(await listModels("openai-compatible", `${base}/ok/v1/`, "k")).toEqual(["a-model", "b-model"]);
    expect(await listModels("openai-compatible", `${base}/gemini`)).toEqual(["gemini-x"]);
  });
  it("meldet abgelehnten Schlüssel und unerreichbare Adresse verständlich", async () => {
    await expect(listModels("openai-compatible", `${base}/auth`)).rejects.toThrow(/Schlüssel/);
    await expect(listModels("openai-compatible", "http://127.0.0.1:1")).rejects.toThrow(/nicht erreichbar/);
  });
});

describe("KI-Anfrage", () => {
  const input = { term: "Mumpitz", categories: [{ name: "Oma-Sprech", keywords: ["oma"] }], entry: "Bedeutung 1: Quatsch", examples: ["Firlefanz\n  Bedeutung 1: Tand"] };

  it("schickt bisherigen Eintrag, Stichwörter und Stilbeispiele mit", () => {
    const p = userPrompt(input);
    expect(p).toContain("Bisheriger Eintrag:\nBedeutung 1: Quatsch");
    expect(p).toContain("Oma-Sprech (Stichwörter: oma)");
    expect(p).toContain("- Firlefanz");
  });

  it("schickt die Beschreibung nur mit, wenn es eine gibt", () => {
    expect(userPrompt({ ...input, hint: "Insider für schlechte Ausreden" })).toContain("Beschreibung der Kuratoren: Insider für schlechte Ausreden");
    expect(userPrompt({ ...input, hint: "" })).not.toContain("Beschreibung der Kuratoren");
    expect(userPrompt(input)).not.toContain("Beschreibung der Kuratoren");
  });

  it("nutzt json_schema und fällt bei Ablehnung auf json_object zurück", async () => {
    formats.length = 0;
    const ok = getAiProvider({ aiProvider: "openai-compatible", aiBaseUrl: `${base}/v1`, aiModel: "m" })!;
    expect((await ok.suggest(input)).shortDefinition).toBe("Unsinn.");
    expect(formats).toEqual(["json_schema"]);
    formats.length = 0;
    const old = getAiProvider({ aiProvider: "openai-compatible", aiBaseUrl: `${base}/noschema/v1`, aiModel: "m" })!;
    expect((await old.suggest(input)).shortDefinition).toBe("Unsinn.");
    expect(formats).toEqual(["json_schema", "json_object"]);
  });
});
