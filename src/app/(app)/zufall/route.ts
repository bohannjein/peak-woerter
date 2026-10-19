import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { randomPublicSlug } from "@/lib/queries";
import { getGuest, getViewer } from "@/lib/access";
import { sfwOn } from "@/lib/sfw";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await getViewer()) && !(await getGuest())) return NextResponse.redirect(new URL("/anmelden", req.url), 307);
  const slug = await randomPublicSlug(db, await sfwOn());
  return NextResponse.redirect(new URL(slug ? `/wort/${slug}` : "/woerter", req.url), 307);
}
