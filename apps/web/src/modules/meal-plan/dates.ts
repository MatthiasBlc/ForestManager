// Dates du calendrier [D180] : dates sans heure (`YYYY-MM-DD`), calculees en UTC
// pour ne pas dependre du fuseau ; "aujourd'hui" est la date locale de l'appareil.
import { WEEKDAYS, type MealTime, type Weekday } from "@fm/shared";

import { MEAL_TIME_LABELS } from "./format.ts";

const DAY = 86_400_000;

const parse = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const format = (date: Date) => date.toISOString().slice(0, 10);

export function addDays(iso: string, days: number): string {
  return format(new Date(parse(iso).getTime() + days * DAY));
}

/** Jour de la semaine, lundi = 0. */
function weekdayIndex(iso: string): number {
  return (parse(iso).getUTCDay() + 6) % 7;
}

export function weekdayOf(iso: string): Weekday {
  return WEEKDAYS[weekdayIndex(iso)] ?? "MON";
}

/** Premier jour de la semaine qui contient `iso`, selon le debut choisi. */
export function weekStart(iso: string, startsOn: Weekday): string {
  const offset = (weekdayIndex(iso) - WEEKDAYS.indexOf(startsOn) + 7) % 7;
  return addDays(iso, -offset);
}

export function weekDays(start: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export function todayIso(now = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const fmt = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", ...options });
const dayMonth = fmt({ day: "numeric", month: "long" });
const dayMonthYear = fmt({ day: "numeric", month: "long", year: "numeric" });
const weekdayLong = fmt({ weekday: "long" });
const weekdayShort = fmt({ weekday: "short" });

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** "Semaine du 2 au 8 novembre", "du 30 novembre au 6 decembre", annees si elles different. */
export function weekLabel(start: string): string {
  const end = addDays(start, 6);
  const [from, to] = [parse(start), parse(end)];
  if (from.getUTCFullYear() !== to.getUTCFullYear()) {
    return `Semaine du ${dayMonthYear.format(from)} au ${dayMonthYear.format(to)}`;
  }
  const first =
    from.getUTCMonth() === to.getUTCMonth() ? String(from.getUTCDate()) : dayMonth.format(from);
  return `Semaine du ${first} au ${dayMonth.format(to)}`;
}

/** "Mardi 3 novembre". */
export function dayLabel(iso: string): string {
  return `${capitalize(weekdayLong.format(parse(iso)))} ${dayMonth.format(parse(iso))}`;
}

/** En-tete de colonne : "MAR" et "3". */
export function shortDay(iso: string): { day: string; num: string } {
  const day = weekdayShort.format(parse(iso)).replace(".", "").slice(0, 3).toUpperCase();
  return { day, num: String(parse(iso).getUTCDate()) };
}

/** Titre de F-REPAS et nom accessible d'un repas : "Mardi 3, soir". */
export function whenLabel(iso: string, mealTime: MealTime): string {
  const day = capitalize(weekdayLong.format(parse(iso)));
  return `${day} ${String(parse(iso).getUTCDate())}, ${MEAL_TIME_LABELS[mealTime].toLowerCase()}`;
}

/** "Du lundi 9 au dimanche 15 novembre" (mois repete s'il change). */
export function periodLabel(from: string, to: string): string {
  const [a, b] = [parse(from), parse(to)];
  const first =
    a.getUTCMonth() === b.getUTCMonth() && a.getUTCFullYear() === b.getUTCFullYear()
      ? String(a.getUTCDate())
      : dayMonth.format(a);
  return `Du ${weekdayLong.format(a)} ${first} au ${weekdayLong.format(b)} ${dayMonth.format(b)}`;
}
