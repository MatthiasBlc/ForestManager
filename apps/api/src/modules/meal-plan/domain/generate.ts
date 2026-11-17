// Algorithme de generation du planning [D113, D182, D184], domaine pur : ni
// Express ni Prisma, aleatoire injecte. Reprise de la V1 (passe principale,
// rattrapage des minimums, rapport) adaptee au calendrier continu :
// - les delais regardent aussi les repas deja places avant et apres la periode ;
// - "par semaine" suit les semaines du calendrier (jour de debut de l'espace),
//   repas hors periode de la semaine compris ;
// - la generation ne refuse jamais : chaque case laissee vide a sa raison.
// Ordre des contraintes (V1) : verrou, exclusion, epinglage, frequence maximale,
// delai de recette, delai de tag, frequence minimale (au mieux), poids.
// Une regle limitee a un repas (midi ou soir) ne s'applique, ne compte et ne
// rattrape que sur ce repas. Une recette de base n'est jamais proposee (D24) ;
// une idee est proposee une fois au plus, sans regle de tag (D182).
// "Remplacer" : un repas existant reste si sa case n'a pas de proposition ; il
// compte donc dans les delais et les frequences tant que sa case n'est pas
// pourvue (sinon l'enregistrement pourrait violer un delai annonce respecte).
import type { Random } from "./random.ts";

export type MealTime = "LUNCH" | "DINNER";
export type Weekday = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";
export type FrequencyPer = "PER_WEEK" | "PER_PERIOD";

const WEEKDAYS: readonly Weekday[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const MEAL_ORDER: readonly MealTime[] = ["LUNCH", "DINNER"];

/** Recette du pool : visible dans l'espace, avec ses tags resolus (fusions suivies). */
export interface PoolRecipe {
  id: string;
  tagIds: readonly string[];
  isBase: boolean;
}

export interface PoolIdea {
  id: string;
}

/** Regle active du profil (tag ou recette) ; les regles endormies ne sont pas passees. */
export interface ProfileRule {
  id: string;
  tagId: string | null;
  recipeId: string | null;
  weight: number;
  mealTime: MealTime | null;
  frequencyMin: number | null;
  frequencyMax: number | null;
  frequencyPer: FrequencyPer | null;
  tagCooldownDays: number | null;
}

export interface WeeklyCell {
  weekday: Weekday;
  mealTime: MealTime;
}

export interface ProfileInput {
  cooldownDays: number;
  useIdeas: boolean;
  rules: readonly ProfileRule[];
  exclusions: readonly WeeklyCell[];
  pins: readonly (WeeklyCell & { tagId: string })[];
}

/** Repas deja ecrit dans la periode. */
export interface ExistingMeal {
  date: string;
  mealTime: MealTime;
  kind: "RECIPE" | "TEXT" | "SKIPPED";
  recipeId: string | null;
  tagIds: readonly string[];
  locked: boolean;
}

/** Repas place hors de la periode (delais et semaines a cheval). */
export interface PlacedMeal {
  date: string;
  mealTime: MealTime;
  recipeId: string | null;
  tagIds: readonly string[];
}

export type MealPick = { kind: "RECIPE"; id: string } | { kind: "IDEA"; id: string };

export interface GenerationInput {
  /** Dates ISO (`YYYY-MM-DD`), bornes comprises. */
  from: string;
  to: string;
  /** Repas planifies par l'espace. */
  mealTimes: readonly MealTime[];
  weekStartsOn: Weekday;
  meals: readonly ExistingMeal[];
  context: readonly PlacedMeal[];
  profile: ProfileInput;
  recipes: readonly PoolRecipe[];
  ideas: readonly PoolIdea[];
  /** Remplacer les repas non verrouilles (sinon : seulement les cases vides). */
  replace: boolean;
  random: Random;
  /** "Proposer un autre repas" : ce choix est ecarte. */
  avoid?: MealPick;
}

/** Pourquoi une case reste vide : la premiere etape qui a vide le pool. */
export type EmptyReason =
  | { code: "NO_RECIPE" }
  | { code: "PIN"; tagId: string }
  | { code: "COOLDOWN"; days: number }
  | { code: "TAG_COOLDOWN"; tagIds: string[] }
  | { code: "FREQUENCY_MAX"; tagIds: string[] }
  | { code: "WEIGHT_ZERO" };

export interface Proposal {
  date: string;
  mealTime: MealTime;
  pick: MealPick | null;
  reason: EmptyReason | null;
  /** Remplacer : la case n'a pas de proposition et son repas actuel reste. */
  keeps: boolean;
}

export type GenerationWarning =
  | {
      code: "MIN_NOT_MET";
      ruleId: string;
      tagId: string;
      required: number;
      actual: number;
      from: string;
      to: string;
    }
  | {
      code: "MAX_EXCEEDED";
      ruleId: string;
      tagId: string;
      max: number;
      actual: number;
      from: string;
      to: string;
    };

export interface GenerationResult {
  /** Une proposition par case a remplir, dans l'ordre du calendrier. */
  proposals: Proposal[];
  skipped: { excluded: number; locked: number; kept: number; skippedMeals: number };
  warnings: GenerationWarning[];
}

// --- Dates ISO ---

const DAY_MS = 86_400_000;
const toTime = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const fromTime = (time: number) => new Date(time).toISOString().slice(0, 10);

function addDays(iso: string, days: number): string {
  return fromTime(toTime(iso) + days * DAY_MS);
}

function distance(a: string, b: string): number {
  return Math.abs(Math.round((toTime(a) - toTime(b)) / DAY_MS));
}

function weekdayOf(iso: string): Weekday {
  // getUTCDay : 0 = dimanche.
  return WEEKDAYS[(new Date(toTime(iso)).getUTCDay() + 6) % 7] ?? "MON";
}

function weekOf(iso: string, startsOn: Weekday): { from: string; to: string } {
  const offset = (WEEKDAYS.indexOf(weekdayOf(iso)) - WEEKDAYS.indexOf(startsOn) + 7) % 7;
  const from = addDays(iso, -offset);
  return { from, to: addDays(from, 6) };
}

// --- Etat de la generation ---

interface Cell {
  date: string;
  mealTime: MealTime;
}

interface Entry {
  pick: MealPick;
  tagIds: readonly string[];
}

/** Repas pris en compte pour les delais et les frequences. */
interface Placement extends Cell {
  pick: MealPick | null;
  tagIds: readonly string[];
}

interface Target extends Cell {
  pinnedTag: string | null;
  pick: MealPick | null;
  tagIds: readonly string[];
  weight: number;
  reason: EmptyReason | null;
  /** Repas actuel de la case (remplacer) : il reste si la case n'est pas pourvue. */
  current: Placement | null;
  keeps: boolean;
  /** Place par le rattrapage : un rattrapage suivant ne le defait pas. */
  protected: boolean;
}

interface Eligible {
  entries: { entry: Entry; weight: number }[];
  reason: EmptyReason | null;
  /** Regles de frequence maximale depassees par un epinglage. */
  exceeded: { rule: ProfileRule; count: number; window: { from: string; to: string } }[];
}

const samePick = (a: MealPick | null, b: MealPick) => a?.kind === b.kind && a.id === b.id;
const appliesTo = (rule: ProfileRule, mealTime: MealTime) =>
  rule.mealTime === null || rule.mealTime === mealTime;
const cellKey = (weekday: Weekday, mealTime: MealTime) => `${weekday}/${mealTime}`;

export function generate(input: GenerationInput): GenerationResult {
  const { profile } = input;
  const mealTimes = MEAL_ORDER.filter((time) => input.mealTimes.includes(time));
  const excluded = new Set(profile.exclusions.map((c) => cellKey(c.weekday, c.mealTime)));
  const pins = new Map(profile.pins.map((p) => [cellKey(p.weekday, p.mealTime), p.tagId]));
  const existing = new Map(input.meals.map((m) => [`${m.date}/${m.mealTime}`, m]));
  const skipped = { excluded: 0, locked: 0, kept: 0, skippedMeals: 0 };

  // Repas fixes : autour de la periode, et ceux de la periode qui restent.
  const fixed: Placement[] = input.context.map((meal) => ({
    date: meal.date,
    mealTime: meal.mealTime,
    pick: meal.recipeId ? { kind: "RECIPE", id: meal.recipeId } : null,
    tagIds: meal.tagIds,
  }));
  const targets: Target[] = [];
  for (let date = input.from; date <= input.to; date = addDays(date, 1)) {
    for (const mealTime of mealTimes) {
      const key = cellKey(weekdayOf(date), mealTime);
      const meal = existing.get(`${date}/${mealTime}`);
      const keep = (counter: keyof typeof skipped) => {
        skipped[counter]++;
        if (meal?.kind === "RECIPE" && meal.recipeId) {
          fixed.push({
            date,
            mealTime,
            pick: { kind: "RECIPE", id: meal.recipeId },
            tagIds: meal.tagIds,
          });
        }
      };
      if (meal?.locked) keep("locked");
      else if (meal?.kind === "SKIPPED") keep("skippedMeals");
      else if (excluded.has(key)) keep("excluded");
      else if (meal && !input.replace) keep("kept");
      else {
        targets.push({
          date,
          mealTime,
          pinnedTag: pins.get(key) ?? null,
          pick: null,
          tagIds: [],
          weight: 0,
          reason: null,
          current:
            meal?.kind === "RECIPE" && meal.recipeId
              ? {
                  date,
                  mealTime,
                  pick: { kind: "RECIPE", id: meal.recipeId },
                  tagIds: meal.tagIds,
                }
              : null,
          keeps: meal !== undefined,
          protected: false,
        });
      }
    }
  }

  /** Ce qui occupe une case a remplir : sa proposition, sinon son repas actuel. */
  const occupant = (t: Target): Placement | null => (t.pick !== null ? t : t.current);
  const placements = (except?: Target): Placement[] => [
    ...fixed,
    ...targets.flatMap((t) => {
      const placed = t === except ? null : occupant(t);
      return placed ? [placed] : [];
    }),
  ];

  const windowOf = (rule: ProfileRule, date: string) =>
    rule.frequencyPer === "PER_PERIOD"
      ? { from: input.from, to: input.to }
      : weekOf(date, input.weekStartsOn);

  const countIn = (
    placed: readonly Placement[],
    rule: ProfileRule,
    window: { from: string; to: string }
  ) =>
    placed.filter(
      (p) =>
        p.date >= window.from &&
        p.date <= window.to &&
        appliesTo(rule, p.mealTime) &&
        rule.tagId !== null &&
        p.tagIds.includes(rule.tagId)
    ).length;

  const weightOf = (entry: Entry, mealTime: MealTime) => {
    if (entry.pick.kind === "IDEA") return 1;
    let weight = 1;
    for (const rule of profile.rules) {
      if (!appliesTo(rule, mealTime)) continue;
      if (rule.tagId !== null && entry.tagIds.includes(rule.tagId)) weight *= rule.weight;
      if (rule.recipeId !== null && entry.pick.id === rule.recipeId) weight *= rule.weight;
    }
    return weight;
  };

  /** Pool de la case, filtre contrainte par contrainte ; la premiere qui le vide est la raison. */
  function eligible(target: Target): Eligible {
    const placed = placements(target);
    const exceeded: Eligible["exceeded"] = [];
    const empty = (reason: EmptyReason): Eligible => ({ entries: [], reason, exceeded });

    const usedIdeas = new Set(placed.flatMap((p) => (p.pick?.kind === "IDEA" ? [p.pick.id] : [])));
    let pool: Entry[] = [
      ...input.recipes
        .filter((r) => !r.isBase)
        .map((r): Entry => ({ pick: { kind: "RECIPE", id: r.id }, tagIds: r.tagIds })),
      ...(profile.useIdeas
        ? input.ideas
            .filter((idea) => !usedIdeas.has(idea.id))
            .map((idea): Entry => ({ pick: { kind: "IDEA", id: idea.id }, tagIds: [] }))
        : []),
    ];
    const avoid = input.avoid;
    if (avoid) pool = pool.filter((entry) => !samePick(entry.pick, avoid));
    if (pool.length === 0) return empty({ code: "NO_RECIPE" });

    // Epinglage : absolu, seulement des recettes du tag.
    const pinned = target.pinnedTag;
    if (pinned !== null) {
      pool = pool.filter((entry) => entry.tagIds.includes(pinned));
      if (pool.length === 0) return empty({ code: "PIN", tagId: pinned });
    }

    // Frequence maximale : un tag au maximum dans sa fenetre est ecarte, sauf epingle.
    const maxed = new Set<string>();
    for (const rule of profile.rules) {
      if (rule.tagId === null || rule.frequencyMax === null) continue;
      if (!appliesTo(rule, target.mealTime)) continue;
      const window = windowOf(rule, target.date);
      const count = countIn(placed, rule, window);
      if (count < rule.frequencyMax) continue;
      if (rule.tagId === pinned) exceeded.push({ rule, count, window });
      else maxed.add(rule.tagId);
    }
    if (maxed.size > 0) {
      pool = pool.filter((entry) => !entry.tagIds.some((tag) => maxed.has(tag)));
      if (pool.length === 0) return empty({ code: "FREQUENCY_MAX", tagIds: [...maxed].sort() });
    }

    // Delai entre deux fois la meme recette, avant et apres la case.
    const days = profile.cooldownDays;
    if (days > 0) {
      const recent = new Set(
        placed.flatMap((p) =>
          p.pick?.kind === "RECIPE" && distance(p.date, target.date) <= days ? [p.pick.id] : []
        )
      );
      pool = pool.filter((entry) => entry.pick.kind === "IDEA" || !recent.has(entry.pick.id));
      if (pool.length === 0) return empty({ code: "COOLDOWN", days });
    }

    // Delai entre deux recettes d'un meme tag.
    const cooling = new Set<string>();
    for (const rule of profile.rules) {
      const tag = rule.tagId;
      const gap = rule.tagCooldownDays;
      if (tag === null || gap === null || !appliesTo(rule, target.mealTime)) continue;
      if (placed.some((p) => p.tagIds.includes(tag) && distance(p.date, target.date) <= gap)) {
        cooling.add(tag);
      }
    }
    if (cooling.size > 0) {
      pool = pool.filter((entry) => !entry.tagIds.some((tag) => cooling.has(tag)));
      if (pool.length === 0) return empty({ code: "TAG_COOLDOWN", tagIds: [...cooling].sort() });
    }

    const weighted = pool
      .map((entry) => ({ entry, weight: weightOf(entry, target.mealTime) }))
      .filter((item) => item.weight > 0);
    if (weighted.length === 0) return empty({ code: "WEIGHT_ZERO" });
    return { entries: weighted, reason: null, exceeded };
  }

  function draw(items: readonly { entry: Entry; weight: number }[]) {
    const total = items.reduce((sum, item) => sum + item.weight, 0);
    let rest = input.random() * total;
    for (const item of items) {
      rest -= item.weight;
      if (rest < 0) return item;
    }
    return items.at(-1);
  }

  const warnings: GenerationWarning[] = [];
  const assign = (target: Target, item: { entry: Entry; weight: number }) => {
    target.pick = item.entry.pick;
    target.tagIds = item.entry.tagIds;
    target.weight = item.weight;
    target.reason = null;
  };

  // Passe principale, dans l'ordre du calendrier.
  for (const target of targets) {
    const found = eligible(target);
    const item = draw(found.entries);
    if (!item) {
      target.reason = found.reason;
      continue;
    }
    assign(target, item);
    for (const { rule, count, window } of found.exceeded) {
      if (rule.tagId === null || !item.entry.tagIds.includes(rule.tagId)) continue;
      warnings.push({
        code: "MAX_EXCEEDED",
        ruleId: rule.id,
        tagId: rule.tagId,
        max: rule.frequencyMax ?? 0,
        actual: count + 1,
        ...window,
      });
    }
  }

  // Rattrapage des frequences minimales, regle par regle dans l'ordre de declaration.
  for (const rule of profile.rules) {
    const tag = rule.tagId;
    const min = rule.frequencyMin;
    if (tag === null || min === null) continue;
    const windows = new Map<string, { from: string; to: string }>();
    for (const target of targets) {
      if (!appliesTo(rule, target.mealTime)) continue;
      const window = windowOf(rule, target.date);
      windows.set(window.from, window);
    }
    for (const window of windows.values()) {
      let count = countIn(placements(), rule, window);
      if (count >= min) continue;
      const candidates = targets
        .filter(
          (t) =>
            t.date >= window.from &&
            t.date <= window.to &&
            appliesTo(rule, t.mealTime) &&
            t.pinnedTag === null &&
            !t.protected &&
            t.pick !== null &&
            !t.tagIds.includes(tag)
        )
        .sort((a, b) => a.weight - b.weight);
      for (const target of candidates) {
        if (count >= min) break;
        const found = eligible(target);
        const item = draw(found.entries.filter((e) => e.entry.tagIds.includes(tag)));
        if (!item) continue;
        assign(target, item);
        target.protected = true;
        count++;
      }
      if (count < min) {
        warnings.push({
          code: "MIN_NOT_MET",
          ruleId: rule.id,
          tagId: tag,
          required: min,
          actual: count,
          ...window,
        });
      }
    }
  }

  return {
    proposals: targets.map((t) => ({
      date: t.date,
      mealTime: t.mealTime,
      pick: t.pick,
      reason: t.pick ? null : t.reason,
      keeps: t.pick === null && t.keeps,
    })),
    skipped,
    warnings,
  };
}
