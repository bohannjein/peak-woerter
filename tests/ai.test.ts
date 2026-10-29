import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listModels } from "@/lib/ai";

// Fake OpenAI-compatible server: /ok answers OpenAI-style, /gemini Gemini-style, /auth refuses.
let base = "";
const server = createServer((req, res) => {
  if (req.url?.startsWith("/auth")) return res.writeHead(401).end();
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
