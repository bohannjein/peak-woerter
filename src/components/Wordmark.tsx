import Link from "next/link";

/** Wordmark: "PEAKE" as a card-number style lockup with "Wörter". */
export function Wordmark({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="group inline-flex items-baseline gap-1.5 rounded-md" aria-label="Peake Wörter – Startseite">
      <span className="display text-[1.65rem] uppercase tracking-tight">Peake</span>
      <span className="font-lex italic text-[1.15rem] text-ink-2 group-hover:text-ink transition-colors">Wörter</span>
    </Link>
  );
}
