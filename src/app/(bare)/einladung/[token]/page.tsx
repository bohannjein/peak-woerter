import type { Metadata } from "next";
import { db } from "@/lib/db";
import { peekLink } from "@/lib/accounts";
import { InviteAcceptForm } from "./form";

export const metadata: Metadata = { title: "Einladung", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Einladung({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await peekLink(db, token, "INVITE");
  if (!link) {
    return (
      <div>
        <h1 className="page-title">Link ungültig.</h1>
        <p className="mt-3 text-ink-2">Abgelaufen oder schon benutzt.</p>
      </div>
    );
  }
  return (
    <div>
      <h1 className="page-title">Du bist eingeladen.</h1>
      <p className="mt-3 text-ink-2">
        {link.grantSeat ? `Kurator, Platz ${link.grantSeat}` : "Lesezugriff"}
        {link.grantAdmin ? " · Verwaltung" : ""}
      </p>
      <InviteAcceptForm token={token} email={link.email} />
    </div>
  );
}
