import type { Settings } from "./settings";

export type Gap = "2fa" | "passkey";

/** Security factors the admin policy requires but the user has not set up. */
export function policyGaps(s: Pick<Settings, "require2fa" | "requirePasskey">, u: { has2fa: boolean; passkeys: number }): Gap[] {
  const missing: Gap[] = [];
  if (s.require2fa && !u.has2fa) missing.push("2fa");
  if (s.requirePasskey && u.passkeys === 0) missing.push("passkey");
  return missing;
}
