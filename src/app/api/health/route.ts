import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Used by the Docker healthcheck. No internal details in the response.
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "db_unavailable" }, { status: 503 });
  }
}
