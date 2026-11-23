// Periode proposee par "Depuis le planning" [D228].
import { addDays } from "../meal-plan/dates.ts";

export interface Period {
  from: string;
  to: string;
}

/**
 * Periode proposee pour la semaine qui commence `weekStart` : jusqu'a sa fin, a
 * partir de demain si elle est en cours (ce qui est deja mange n'est plus a acheter).
 */
export function planPeriod(tomorrow: string, weekStart: string): Period {
  const to = addDays(weekStart, 6);
  const from = tomorrow > weekStart && tomorrow <= to ? tomorrow : weekStart;
  return { from, to };
}
