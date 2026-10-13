import { Wordmark } from "@/components/Wordmark";

export default function BareLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pt-safe min-h-dvh px-4 pb-16">
      <header className="mx-auto flex h-16 max-w-md items-center">
        <Wordmark />
      </header>
      <main id="inhalt" className="mx-auto max-w-md pt-6">
        {children}
      </main>
    </div>
  );
}
