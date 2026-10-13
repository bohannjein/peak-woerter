import type { Metadata } from "next";
import { db } from "@/lib/db";
import { peekLink } from "@/lib/accounts";
import { ResetForm } from "./form";

export const metadata: Metadata = { title: "Passwort zurücksetzen", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Reset({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await peekLink(db, token, "RESET");
  return (
    <div>
      <h1 className="page-title">{link ? "Neues Passwort" : "Link ungültig."}</h1>
      {link ? (
        <>
          <p className="mt-3 text-ink-2">
            Alle Sitzungen werden beendet.
          </p>
          <ResetForm token={token} />
        </>
      ) : (
        <p className="mt-3 text-ink-2">Abgelaufen oder schon benutzt.</p>
      )}
    </div>
  );
}
