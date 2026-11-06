// Dates de l'administration, comme les maquettes : "Aujourd'hui, 14 h 02", "Hier, 21 h 15", "28 oct.".

const DAY_MS = 24 * 60 * 60 * 1000;
const time = new Intl.DateTimeFormat("fr-FR", { hour: "numeric", minute: "2-digit" });
const day = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function hourLabel(date: Date): string {
  return time.format(date).replace(":", " h ");
}

/** Date d'un evenement : jour relatif et heure, ou jour et mois. */
export function whenLabel(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const days = Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS);
  if (days === 0) return `Aujourd'hui, ${hourLabel(date)}`;
  if (days === 1) return `Hier, ${hourLabel(date)}`;
  return day.format(date);
}

/** Anciennete : "aujourd'hui", "hier", "il y a 3 jours". */
export function agoLabel(iso: string, now = new Date()): string {
  const days = Math.round((startOfDay(now) - startOfDay(new Date(iso))) / DAY_MS);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  return `il y a ${String(days)} jours`;
}
