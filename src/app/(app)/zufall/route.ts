import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { randomPublicSlug } from "@/lib/queries";
import { getGuest, getViewer } from "@/lib/access";
import { sfwOn } from "@/lib/sfw";
import { siteUrl } from "@/lib/url";

export const dynamic = "force-dynamic";

// Behind the reverse proxy req.url is the container address (localhost:3000), so build redirects from PUBLIC_URL.
export async function GET() {
  if (!(await getViewer()) && !(await getGuest())) return NextResponse.redirect(`${siteUrl()}/anmelden`, 307);
  const slug = await randomPublicSlug(db, await sfwOn());
  return NextResponse.redirect(`${siteUrl()}${slug ? `/wort/${slug}` : "/woerter"}`, 307);
}
