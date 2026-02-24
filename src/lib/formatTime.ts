/**
 * Format message timestamp:
 * - Today: time only (2:34 PM)
 * - Older same year: date + time (Feb 15, 2:34 PM)
 * - Different year: include year
 */
export function formatMessageTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  const sameYear = d.getFullYear() === now.getFullYear();

  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  if (sameDay) return time;
  if (sameYear) {
    const date = d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    return `${date}, ${time}`;
  }
  const date = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${date}, ${time}`;
}
