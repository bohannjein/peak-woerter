import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireStaffPage } from "@/lib/access";
import { CategoryManager } from "./CategoryManager";

export const metadata: Metadata = { title: "Kategorien", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Kategorien() {
  await requireStaffPage();
  const cats = await db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, color: true, _count: { select: { words: true } } } });
  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 md:px-6 md:pt-10">
      <h1 className="page-title">Kategorien</h1>
      <CategoryManager categories={cats.map((c) => ({ id: c.id, name: c.name, color: c.color, count: c._count.words }))} />
    </div>
  );
}
