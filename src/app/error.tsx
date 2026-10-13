"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="grid min-h-[70dvh] place-items-center px-4">
      <div className="max-w-sm">
        <h1 className="page-title">Kartensalat.</h1>
        <p className="mt-3 text-ink-2">Etwas ist schiefgelaufen.</p>
        <button type="button" onClick={reset} className="btn btn-primary mt-6">
          Erneut versuchen
        </button>
      </div>
    </main>
  );
}
