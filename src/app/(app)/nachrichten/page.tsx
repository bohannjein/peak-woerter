import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireMemberPage } from "@/lib/access";
import { formatDate } from "@/lib/time";
import { MarkRead } from "./MarkRead";

export const metadata: Metadata = { title: "Nachrichten", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Nachrichten() {
  const v = await requireMemberPage();
  const items = await db.notification.findMany({ where: { userId: v.id }, orderBy: { createdAt: "desc" }, take: 100 });
  const unread = items.some((n) => !n.readAt);

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 md:px-6 md:pt-10">
      <h1 className="page-title">Nachrichten</h1>
      {unread && <MarkRead />}
      {items.length === 0 ? (
        <p className="mt-12 text-lg text-ink-3">Keine Nachrichten.</p>
      ) : (
        <ul className="mt-8">
          {items.map((n) => {
            const body = (
              <>
                <span className="flex items-baseline gap-2">
                  {!n.readAt && <span className="size-2.5 shrink-0 rounded-full bg-no" aria-label="neu" />}
                  <span className={n.readAt ? "" : "font-semibold"}>{n.body}</span>
                </span>
                <span className="mt-1 block text-sm text-ink-3">{formatDate(n.createdAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
              </>
            );
            return (
              <li key={n.id} className="border-t border-line">
                {n.href ? (
                  <Link href={n.href} className="block py-4 hover:bg-table-2">
                    {body}
                  </Link>
                ) : (
                  <div className="py-4">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
