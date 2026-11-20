/**
 * The first `max` items, comma-separated, then ` (+N more)` for the rest,
 * so a list can't push a message past Discord's length limit.
 */
export function listUpTo(items: readonly string[], max: number): string {
  const more = items.length - max;
  return items.slice(0, max).join(', ') + (more > 0 ? ` (+${more} more)` : '');
}
