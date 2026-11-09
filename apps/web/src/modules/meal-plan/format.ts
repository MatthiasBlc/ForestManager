// Libelles du module Planning (interface en francais).
import type { MealTime, SpaceRole, Weekday } from "@fm/shared";

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
