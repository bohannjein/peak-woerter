// Extra rights an admin can grant to members. Curators and admins have all of them;
// the vote itself is never a permission, it comes only with a curator seat.
export const PERMISSIONS = {
  edit: "Einträge bearbeiten und Datenbank pflegen",
  tags: "Tags vergeben und Kategorien verwalten",
  context: "Kontext und Kommentare hinzufügen",
  negative: "Negativliste einsehen und pflegen",
} as const;

export type Permission = keyof typeof PERMISSIONS;
export const PERMISSION_KEYS = Object.keys(PERMISSIONS) as Permission[];

export function can(v: { seat: number | null; isAdmin: boolean; permissions: string[] } | null | undefined, p: Permission) {
  return !!v && (!!v.seat || v.isAdmin || v.permissions.includes(p));
}
