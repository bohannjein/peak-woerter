import type { Metadata } from "next";
import { requireMemberPage } from "@/lib/access";
import { APP_VERSION, CHANGELOG } from "@/lib/changelog";
import { markNewsSeen } from "@/lib/news";
import { ReleaseList } from "@/components/WhatsNew";

export const metadata: Metadata = { title: "Was ist neu", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Neuigkeiten() {
  const v = await requireMemberPage();
  await markNewsSeen(v.id);
  return (
    <div className="mx-auto max-w-2xl px-4 pt-6 pb-16 md:px-6 md:pt-10">
      <h1 className="page-title">Was ist neu</h1>
      <p className="mt-2 text-ink-2">Peake Wörter v{APP_VERSION}. Hier stehen alle Änderungen, seit es Versionsnummern gibt.</p>
      <div className="mt-6">
        <ReleaseList releases={CHANGELOG} showVersion />
      </div>
    </div>
  );
}
