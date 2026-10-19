/** Profile picture or initials. `v` busts the cache when the picture changes. */
export function Avatar({ user, size = 48 }: { user: { id: string; name: string; avatarPath?: string | null }; size?: number }) {
  const initials = user.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return user.avatarPath ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/api/avatar/${user.id}?v=${encodeURIComponent(user.avatarPath)}`} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span aria-hidden className="display grid shrink-0 place-items-center rounded-full bg-ink text-table" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {initials}
    </span>
  );
}
