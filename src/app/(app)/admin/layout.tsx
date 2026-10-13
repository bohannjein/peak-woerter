import Link from "next/link";
import { requireAdminPage } from "@/lib/access";
import { AdminNav } from "./AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage();
  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 md:px-6 md:pt-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="page-title">Verwaltung</h1>
        <Link href="/k" className="text-sm font-semibold text-ink-2 hover:text-ink">
          Zur Übersicht
        </Link>
      </div>
      <AdminNav />
      <div className="mt-8">{children}</div>
    </div>
  );
}
