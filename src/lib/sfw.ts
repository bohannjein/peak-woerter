import "server-only";
import { cookies } from "next/headers";

/** SFW mode (cookie set by SfwToggle): hide words in NSFW categories. */
export async function sfwOn() {
  return (await cookies()).get("sfw")?.value === "1";
}
