// Dates du centre de notifications (maquette E-NOTIFICATIONS) : groupes par jour
// et anciennete courte ("Il y a 20 min", "Hier, 21 h 15", "2 nov.").

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const time = new Intl.DateTimeFormat("fr-FR", { hour: "numeric", minute: "2-digit" });
const day = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function daysAgo(date: Date, now: Date): number {
  return Math.round((startOfDay(now) - startOfDay(date)) / DAY);
}

/** Groupe d'une notification : Aujourd'hui, Hier, Plus tot. */
export function dayGroup(iso: string, now = new Date()): "Aujourd'hui" | "Hier" | "Plus tôt" {
  const days = daysAgo(new Date(iso), now);
  if (days <= 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  return "Plus tôt";
}

export function ageLabel(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const elapsed = now.getTime() - date.getTime();
  if (elapsed < MINUTE) return "À l'instant";
  if (elapsed < HOUR) return `Il y a ${String(Math.floor(elapsed / MINUTE))} min`;
  if (daysAgo(date, now) <= 0) return `Il y a ${String(Math.floor(elapsed / HOUR))} h`;
  if (daysAgo(date, now) === 1) return `Hier, ${time.format(date).replace(":", " h ")}`;
  return day.format(date);
}
