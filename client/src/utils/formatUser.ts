/** Trims and collapses runs of whitespace: "  Jane   Doe " -> "Jane Doe". */
export function formatDisplayName(name?: string | null): string {
  return (name || '').trim().replace(/\s+/g, ' ');
}

export function formatEmail(email?: string | null): string {
  return (email || '').trim();
}

/** Up to two initials for an avatar, e.g. "Jane Doe" -> "JD". */
export function getInitials(name?: string | null): string {
  const parts = formatDisplayName(name).split(' ').filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || '?';
}
