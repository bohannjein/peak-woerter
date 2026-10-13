import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireStaffPage } from "@/lib/access";
import { AddWordForm } from "./form";

export const metadata: Metadata = { title: "Wort hinzufügen", robots: { index: false } };

export default async function Neu() {
  const v = await requireStaffPage();
  if (!v.seat) redirect("/admin");
  return (
    <div className="mx-auto max-w-xl px-4 pt-6 md:pt-10">
      <h1 className="page-title">Neues Wort</h1>
      <AddWordForm />
    </div>
  );
}
