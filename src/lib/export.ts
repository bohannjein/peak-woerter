// List export for everyone (members and guests): public fields of public words only.
// Every file carries the export time and an HMAC signature over its rows; the
// SHA-256 of every file is logged, so /export/pruefen can confirm a file is genuine.
import { createHash, createHmac } from "node:crypto";
import { crc32 } from "node:zlib";
import type { Db } from "./db";
import { POS_LABEL } from "./categories";
import { publicWhere } from "./queries";
import { formatDate } from "./time";

export const FORMATS = {
  csv: { label: "CSV (UTF-8)", mime: "text/csv; charset=utf-8" },
  xlsx: { label: "Excel (XLSX)", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  json: { label: "JSON", mime: "application/json; charset=utf-8" },
  sql: { label: "SQL", mime: "application/sql; charset=utf-8" },
  txt: { label: "Text (TXT)", mime: "text/plain; charset=utf-8" },
  md: { label: "Markdown", mime: "text/markdown; charset=utf-8" },
} as const;
export type Format = keyof typeof FORMATS;
export type Order = "az" | "neu" | "kat";

export const COLUMNS = ["Nr", "Wort", "Wortart", "Lautschrift", "Bedeutung", "Beispiele", "Verwendung", "Herkunft", "Kategorien", "Aufgenommen"] as const;
export type Row = Record<(typeof COLUMNS)[number], string>;

export async function exportRows(db: Db, order: Order, sfw = false): Promise<Row[]> {
  const words = await db.word.findMany({
    where: publicWhere(sfw),
    orderBy: order === "neu" ? { acceptedAt: "desc" } : { normalized: "asc" },
    select: {
      cardNumber: true,
      term: true,
      partOfSpeech: true,
      usage: true,
      origin: true,
      acceptedAt: true,
      definitions: { orderBy: { position: "asc" }, select: { text: true } },
      pronunciations: { where: { verified: true }, orderBy: { position: "asc" }, select: { ipa: true } },
      examples: { orderBy: { position: "asc" }, select: { text: true } },
      categories: { select: { category: { select: { name: true } } } },
    },
  });
  const rows = words.map((w) => ({
    Nr: w.cardNumber ? String(w.cardNumber) : "",
    Wort: w.term,
    Wortart: w.partOfSpeech ? POS_LABEL[w.partOfSpeech] : "",
    Lautschrift: w.pronunciations.map((p) => `[${p.ipa}]`).join(" "),
    Bedeutung: w.definitions.map((d, i) => (w.definitions.length > 1 ? `${i + 1}. ${d.text}` : d.text)).join(" "),
    Beispiele: w.examples.map((e) => e.text).join(" | "),
    Verwendung: w.usage ?? "",
    Herkunft: w.origin ?? "",
    Kategorien: w.categories.map((c) => c.category.name).sort((a, b) => a.localeCompare(b, "de")).join(", "),
    Aufgenommen: w.acceptedAt?.toISOString().slice(0, 10) ?? "",
  }));
  if (order === "kat") {
    // Grouped by first category; words without a category last.
    rows.sort((a, b) => (a.Kategorien || "￿").localeCompare(b.Kategorien || "￿", "de") || a.Wort.localeCompare(b.Wort, "de"));
  }
  return rows;
}

export function sign(exportedAt: string, rows: Row[], secret = process.env.BETTER_AUTH_SECRET ?? "") {
  return createHmac("sha256", secret).update(JSON.stringify({ exportedAt, rows })).digest("hex");
}

export const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");

// ───────────── Writers ─────────────

const csvCell = (s: string) => {
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s; // spreadsheet formula injection
  return `"${safe.replace(/"/g, '""')}"`;
};
const xml = (s: string) => s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
const sqlStr = (s: string) => (s ? `'${s.replace(/'/g, "''")}'` : "NULL");

export function render(format: Format, rows: Row[], meta: { exportedAt: string; signature: string; by: string }): Buffer {
  const stamp = `Peake Wörter · Export vom ${formatDate(meta.exportedAt, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })} · ${rows.length} Wörter · von ${meta.by}`;
  const sig = `Signatur (HMAC-SHA256): ${meta.signature}`;
  switch (format) {
    case "csv":
      return Buffer.from(
        "﻿" + [COLUMNS.map(csvCell).join(";"), ...rows.map((r) => COLUMNS.map((c) => csvCell(r[c])).join(";")), "", csvCell(stamp), csvCell(sig)].join("\r\n"),
      );
    case "json":
      return Buffer.from(JSON.stringify({ exportedAt: meta.exportedAt, exportedBy: meta.by, count: rows.length, signature: meta.signature, rows }, null, 2));
    case "sql":
      return Buffer.from(
        [
          `-- ${stamp}`,
          `-- ${sig}`,
          `CREATE TABLE peake_woerter (nr INTEGER, wort TEXT NOT NULL, wortart TEXT, lautschrift TEXT, bedeutung TEXT, beispiele TEXT, verwendung TEXT, herkunft TEXT, kategorien TEXT, aufgenommen DATE);`,
          ...rows.map(
            (r) => `INSERT INTO peake_woerter VALUES (${r.Nr || "NULL"}, ${[r.Wort, r.Wortart, r.Lautschrift, r.Bedeutung, r.Beispiele, r.Verwendung, r.Herkunft, r.Kategorien, r.Aufgenommen].map(sqlStr).join(", ")});`,
          ),
          "",
        ].join("\n"),
      );
    case "txt":
      return Buffer.from(
        [stamp, "", ...rows.map((r) => [r.Wort, r.Lautschrift, r.Wortart && `(${r.Wortart})`, r.Bedeutung && `– ${r.Bedeutung}`].filter(Boolean).join(" ")), "", sig, ""].join("\n"),
      );
    case "md":
      return Buffer.from(
        [
          "# Peake Wörter",
          "",
          `_${stamp}_`,
          "",
          ...rows.map((r) => `- **${r.Wort}**${r.Lautschrift ? ` ${r.Lautschrift}` : ""}${r.Wortart ? ` _${r.Wortart}_` : ""}${r.Bedeutung ? ` — ${r.Bedeutung}` : ""}`),
          "",
          `<sub>${sig}</sub>`,
          "",
        ].join("\n"),
      );
    case "xlsx":
      return xlsx([[...COLUMNS], ...rows.map((r) => COLUMNS.map((c) => r[c])), [], [stamp], [sig]]);
  }
}

// ───────────── Minimal XLSX (Office Open XML in an uncompressed zip) ─────────────

function zip(files: [string, string][]): Buffer {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of files) {
    const data = Buffer.from(content);
    const n = Buffer.from(name);
    const crc = crc32(data);
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0);
    h.writeUInt16LE(20, 4);
    h.writeUInt16LE(0x0800, 6); // UTF-8 names
    h.writeUInt32LE(crc, 14);
    h.writeUInt32LE(data.length, 18);
    h.writeUInt32LE(data.length, 22);
    h.writeUInt16LE(n.length, 26);
    local.push(h, n, data);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(0x0800, 8);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(data.length, 20);
    c.writeUInt32LE(data.length, 24);
    c.writeUInt16LE(n.length, 28);
    c.writeUInt32LE(offset, 42);
    central.push(c, n);
    offset += 30 + n.length + data.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, cd, end]);
}

function xlsx(table: string[][]): Buffer {
  const col = (i: number) => (i >= 26 ? String.fromCharCode(64 + Math.floor(i / 26)) : "") + String.fromCharCode(65 + (i % 26));
  const sheet =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>` +
    table
      .map((row, r) => `<row r="${r + 1}">${row.map((v, c) => `<c r="${col(c)}${r + 1}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`).join("")}</row>`)
      .join("") +
    `</sheetData></worksheet>`;
  return zip([
    [
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    ],
    [
      "_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ],
    [
      "xl/workbook.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Peake Wörter" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    ],
    [
      "xl/_rels/workbook.xml.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    ],
    ["xl/worksheets/sheet1.xml", sheet],
  ]);
}
