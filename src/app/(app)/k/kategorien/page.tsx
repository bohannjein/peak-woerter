import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requirePermissionPage } from "@/lib/access";
import { CategoryManager } from "./CategoryManager";

export const metadata: Metadata = { title: "Kategorien", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Kategorien() {
  await requirePermissionPage("tags");
  const cats = await db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, color: true, nsfw: true, keywords: true, _count: { select: { words: true } } } });
  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 md:px-6 md:pt-10">
      <h1 className="page-title">Kategorien</h1>
      <CategoryManager categories={cats.map((c) => ({ id: c.id, name: c.name, color: c.color, nsfw: c.nsfw, keywords: c.keywords, count: c._count.words }))} />
    </div>
  );
}
