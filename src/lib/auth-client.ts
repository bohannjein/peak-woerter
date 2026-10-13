"use client";
import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";

export const authClient = createAuthClient({ plugins: [twoFactorClient(), passkeyClient()] });

/** Better Auth error codes → German messages. */
export function authError(e: { code?: string; message?: string; status?: number } | null | undefined): string {
  const map: Record<string, string> = {
    INVALID_EMAIL_OR_PASSWORD: "E-Mail oder Passwort stimmt nicht.",
    INVALID_CODE: "Der Code stimmt nicht.",
    INVALID_TWO_FACTOR_COOKIE: "Abgelaufen. Bitte neu anmelden.",
    INVALID_BACKUP_CODE: "Dieser Wiederherstellungscode ist ungültig oder schon verbraucht.",
    INVALID_PASSWORD: "Das Passwort stimmt nicht.",
    PASSKEY_NOT_FOUND: "Dieser Passkey ist hier nicht registriert.",
    TOO_MANY_ATTEMPTS: "Zu viele Versuche. Bitte warte ein paar Minuten.",
  };
  if (e?.status === 429) return "Zu viele Versuche. Bitte warte kurz.";
  return (e?.code && map[e.code]) || "Fehlgeschlagen. Bitte erneut versuchen.";
}
