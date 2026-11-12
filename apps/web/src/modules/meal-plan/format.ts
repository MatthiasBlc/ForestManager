// Libelles du module Planning (interface en francais).
import type {
  EmptyReason,
  GenerationPreview,
  GenerationWarning,
  MealTime,
  Rule,
  SpaceRole,
  Weekday,
} from "@fm/shared";
import { plural } from "../../lib/plural.ts";

export const MEAL_TIME_LABELS: Record<MealTime, string> = {
  LUNCH: "Midi",
  DINNER: "Soir",
};

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  MON: "Lundi",
  TUE: "Mardi",
  WED: "Mercredi",
  THU: "Jeudi",
  FRI: "Vendredi",
  SAT: "Samedi",
  SUN: "Dimanche",
};

/** Role minimal pour modifier un repas, tel que l'affiche F-REGLAGES-PLANNING. */
export const EDIT_ROLE_LABELS: Record<SpaceRole, string> = {
  MEMBER: "Membres et plus",
  MODERATOR: "Modérateurs et propriétaire",
  OWNER: "Propriétaire seulement",
};

/** Repas en minuscules, dans une phrase ("jeudi midi"). */
export const MEAL_TIME_WORDS: Record<MealTime, string> = { LUNCH: "midi", DINNER: "soir" };

/** Paliers de poids [D184], dans l'ordre de WEIGHT_STEPS. */
export const WEIGHT_STEP_LABELS: Record<number, string> = {
  0: "Jamais",
  0.5: "Moins souvent",
  1: "Normal",
  1.5: "Plus souvent",
  2: "Beaucoup plus",
};

const number = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

/** "×1,5" ; "jamais" pour un poids nul. */
export function weightLabel(weight: number): string {
  return weight === 0 ? "jamais" : `×${number.format(weight)}`;
}

function frequencyLabel(rule: Rule): string | null {
  const { frequencyMin: min, frequencyMax: max } = rule;
  if (min === null && max === null) return null;
  const per = rule.frequencyPer === "PER_PERIOD" ? "sur la période" : "par semaine";
  const times = (n: number) => `${String(n)} fois`;
  if (min !== null && max !== null) {
    return min === max ? `${times(min)} ${per}` : `${String(min)} à ${times(max)} ${per}`;
  }
  return min !== null ? `au moins ${times(min)} ${per}` : `au plus ${times(max ?? 0)} ${per}`;
}

/** Resume d'une regle : "Le soir · au moins 2 fois par semaine · poids ×1,5". */
export function ruleDetail(rule: Rule): string {
  const parts = [
    rule.mealTime ? `le ${MEAL_TIME_WORDS[rule.mealTime]}` : null,
    frequencyLabel(rule),
    rule.tagCooldownDays ? `${String(rule.tagCooldownDays)} j entre deux` : null,
    rule.weight === 1 ? null : `poids ${weightLabel(rule.weight)}`,
  ].filter((part): part is string => part !== null);
  const text = parts.length > 0 ? parts.join(" · ") : "poids normal";
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

const quoted = (tags: readonly { name: string }[]) => tags.map((t) => `« ${t.name} »`).join(", ");

/** Pourquoi la generation laisse un repas vide [D113]. */
export function reasonText(reason: EmptyReason): string {
  switch (reason.code) {
    case "NO_RECIPE":
      return "Aucune recette disponible pour ce repas.";
    case "PIN":
      return `Aucune recette du tag « ${reason.tag.name} », épinglé sur ce repas.`;
    case "FREQUENCY_MAX":
      return `${quoted(reason.tags)} a déjà atteint son maximum et les autres recettes sont écartées.`;
    case "COOLDOWN":
      return `Toutes les recettes ont été prévues il y a moins de ${String(reason.days)} jours.`;
    case "TAG_COOLDOWN":
      return `Les recettes restantes (${quoted(reason.tags)}) reviendraient trop tôt.`;
    case "WEIGHT_ZERO":
      return "Les règles du profil écartent toutes les recettes restantes.";
  }
}

const dayMonth = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
const dayOf = (iso: string) => dayMonth.format(new Date(`${iso}T00:00:00Z`));

/** Ecart du rapport : minimum non atteint, maximum depasse par un epinglage. */
export function warningText(warning: GenerationWarning): string {
  if (warning.code === "MIN_NOT_MET") {
    return `« ${warning.tag.name} » : ${String(warning.actual)} fois au lieu de ${String(warning.required)} au moins, semaine du ${dayOf(warning.from)}.`;
  }
  return `« ${warning.tag.name} » : ${String(warning.actual)} fois pour ${String(warning.max)} au plus, à cause d'un épinglage (semaine du ${dayOf(warning.from)}).`;
}

/** Repas du rapport que la generation n'a pas touches, ou null s'il n'y en a pas. */
export function skippedText(skipped: GenerationPreview["skipped"]): string | null {
  const parts = [
    skipped.excluded > 0 ? plural(skipped.excluded, "exclu", "exclus") : null,
    skipped.locked > 0 ? plural(skipped.locked, "verrouillé", "verrouillés") : null,
    skipped.kept > 0 ? plural(skipped.kept, "déjà rempli", "déjà remplis") : null,
    skipped.skippedMeals > 0 ? `${String(skipped.skippedMeals)} « Pas de repas »` : null,
  ].filter((part) => part !== null);
  return parts.length > 0 ? `Laissés tels quels : ${parts.join(", ")}.` : null;
}
