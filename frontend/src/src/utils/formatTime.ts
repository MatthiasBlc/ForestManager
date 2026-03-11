/**
 * Formate une date en temps relatif en francais (sans accents).
 * Ex: "a l'instant", "il y a 2min", "il y a 3j"
 */
export function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return "a l'instant";

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `il y a ${diffMin}min`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `il y a ${diffHours}h`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `il y a ${diffDays}j`;

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 5) return `il y a ${diffWeeks}sem`;

  return new Date(dateStr).toLocaleDateString("fr-FR");
}
