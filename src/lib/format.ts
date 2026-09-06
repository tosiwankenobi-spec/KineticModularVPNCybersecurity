/**
 * Formats a timestamp (ms since epoch) as a short relative time string,
 * e.g. "12s ago", "5m ago", "3h ago". Used for alert/notification history.
 */
export function formatRelativeTime(ts: number, now: number = Date.now()): string {
  const s = Math.floor((now - ts) / 1000);
  if (s < 60) return `${Math.max(s, 0)}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}
