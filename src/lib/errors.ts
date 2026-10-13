// Errors whose message is safe to show to the user. Anything else is logged
// and replaced by a generic message.
export class AppError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
    this.name = "AppError";
  }
}

export type ActionState = { ok?: boolean; error?: string; message?: string; data?: unknown } | null;

export async function safeAction<T>(fn: () => Promise<T>): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof AppError) return { ok: false, error: e.message };
    // Unique-constraint race (e.g. double vote from two tabs).
    if (typeof e === "object" && e && "code" in e && (e as { code: string }).code === "P2002") {
      return { ok: false, error: "Bereits erledigt." };
    }
    console.error(e);
    return { ok: false, error: "Fehler. Bitte erneut versuchen." };
  }
}
