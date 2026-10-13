import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="card-stock band-ink w-full max-w-sm overflow-hidden">
        <div className="flex h-11 items-center px-5 condensed text-[0.82rem] font-extrabold uppercase tracking-[0.08em]" style={{ background: "var(--band)", color: "var(--band-ink)" }}>
          Fehlkarte
        </div>
        <div className="p-6">
          <h1 className="display text-4xl">Nicht im Archiv.</h1>
          <Link href="/" className="btn mt-6 bg-card-ink text-card">
            Zur Startseite
          </Link>
        </div>
      </div>
    </main>
  );
}
