import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requirePermissionPage } from "@/lib/access";
import { getSettings } from "@/lib/settings";
import { getAiProvider, type Suggestion } from "@/lib/ai";
import { EntryEditor } from "./EntryEditor";

export const metadata: Metadata = { title: "Eintrag bearbeiten", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Bearbeiten({ params }: { params: Promise<{ id: string }> }) {
  await requirePermissionPage("edit");
  const { id } = await params;
  const [w, categories, settings] = await Promise.all([
    db.word.findUnique({
      where: { id },
      include: {
        definitions: { orderBy: { position: "asc" } },
        pronunciations: { orderBy: { position: "asc" } },
        examples: { orderBy: { position: "asc" } },
        categories: true,
        aiDrafts: { where: { status: "DRAFT" }, orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, color: true } }),
    getSettings(db),
  ]);
  if (!w) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 md:px-6 md:pt-10">
      <Link href={`/k/wort/${w.id}`} className="inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-ink-2 hover:text-ink">
        <ArrowLeft size={16} aria-hidden /> Zurück zum Wort
      </Link>
      <h1 className="page-title mt-4">Eintrag</h1>
      <EntryEditor
        wordId={w.id}
        status={w.status}
        categories={categories}
        aiAvailable={!!getAiProvider(settings)}
        draft={w.aiDrafts[0] ? { id: w.aiDrafts[0].id, content: w.aiDrafts[0].content as Suggestion } : null}
        initial={{
          term: w.term,
          partOfSpeech: w.partOfSpeech,
          grammar: w.grammar ?? "",
          usage: w.usage ?? "",
          origin: w.origin ?? "",
          variants: w.variants,
          definitions: w.definitions.map((d) => ({ text: d.text, detail: d.detail ?? "" })),
          pronunciations: w.pronunciations.map((p) => ({ ipa: p.ipa, label: p.label ?? "", verified: p.verified, position: p.position, hasAudio: !!p.audioPath })),
          examples: w.examples.map((e) => e.text),
          categoryIds: w.categories.map((c) => c.categoryId),
        }}
      />
    </div>
  );
}
