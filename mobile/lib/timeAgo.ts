const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < MINUTE) return "now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h`;
  const days = Math.floor(diff / DAY);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}
