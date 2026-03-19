/**
 * Meal Generation Algorithm
 * Logique metier isolee pour la generation automatique du planning de repas
 */

import {
  MealGenerationParams,
  MealSlotExclusion,
  MealGenerationRule,
  MealSlotPin,
  MealTime,
  FrequencyPer,
} from "@prisma/client";

// =============================================
// Types
// =============================================

/** Recette dans le pool de generation */
export interface PoolEntry {
  id: string; // recipeId ou ideaId
  type: "RECIPE" | "IDEA"; // source
  recipeId: string | null; // null pour idees sans recette
  tagIds: string[]; // tags de la recette (vide pour idees sans recette)
  // Pour idees sans recette -> FREE_TEXT
  freeText?: string;
  comment?: string | null;
}

/** Slot a traiter */
export interface SlotInfo {
  id: string;
  date: Date;
  mealTime: MealTime;
  type: string;
  disabled: boolean;
  locked: boolean;
  recipeId: string | null;
}

/** Resultat d'un slot rempli par la generation */
export interface SlotAssignment {
  slotId: string;
  recipeId: string | null;
  type: "RECIPE" | "FREE_TEXT" | "EMPTY";
  freeText?: string | null;
  comment?: string | null;
  /** Poids final de la recette choisie (pour rattrapage) */
  weight: number;
}

/** Slot rempli du plan archive precedent (pour cross-planning cooldown) */
export interface PreviousSlotInfo {
  date: Date;
  recipeId: string | null;
  tagIds: string[];
}

export interface GenerationWarning {
  type:
    | "POOL_EXHAUSTED"
    | "FREQUENCY_MIN_NOT_MET"
    | "FREQUENCY_MAX_EXCEEDED"
    | "CONFLICTING_CONSTRAINTS";
  slotDay?: string;
  slotMealTime?: string;
  tagId?: string;
  tagName?: string;
  required?: number;
  actual?: number;
  reason: string;
}

export interface GenerationReport {
  slotsGenerated: number;
  slotsSkipped: {
    excluded: number;
    locked: number;
    disabled: number;
    alreadyFilled: number;
  };
  slotsEmpty: number;
  warnings: GenerationWarning[];
}

export interface GenerationResult {
  assignments: SlotAssignment[];
  report: GenerationReport;
}

// =============================================
// Helpers
// =============================================

const DAY_OF_WEEK_MAP: Record<number, string> = {
  0: "SUN",
  1: "MON",
  2: "TUE",
  3: "WED",
  4: "THU",
  5: "FRI",
  6: "SAT",
};

export function dateToDayOfWeek(date: Date): string {
  return DAY_OF_WEEK_MAP[new Date(date).getUTCDay()];
}

/** Difference en jours entre deux dates (entiers positifs) */
function daysBetween(a: Date, b: Date): number {
  const msPerDay = 86400000;
  const dateA = new Date(a);
  const dateB = new Date(b);
  dateA.setUTCHours(0, 0, 0, 0);
  dateB.setUTCHours(0, 0, 0, 0);
  return Math.abs(Math.floor((dateB.getTime() - dateA.getTime()) / msPerDay));
}

/** Tirage aleatoire pondere */
export function weightedRandomPick<T>(items: T[], weights: number[]): T | null {
  if (items.length === 0) return null;
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  if (totalWeight <= 0) return null;

  let random = Math.random() * totalWeight;
  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) return items[i];
  }
  return items[items.length - 1];
}

// =============================================
// Main generation function
// =============================================

export interface GenerationInput {
  params: MealGenerationParams;
  exclusions: MealSlotExclusion[];
  rules: (MealGenerationRule & { tag?: { id: string; name: string } | null })[];
  pins: MealSlotPin[];
  slots: SlotInfo[];
  pool: PoolEntry[];
  previousSlots: PreviousSlotInfo[];
  fillEmptyOnly: boolean;
}

export function generate(input: GenerationInput): GenerationResult {
  const { params, exclusions, rules, pins, slots, pool, previousSlots, fillEmptyOnly } = input;

  const report: GenerationReport = {
    slotsGenerated: 0,
    slotsSkipped: { excluded: 0, locked: 0, disabled: 0, alreadyFilled: 0 },
    slotsEmpty: 0,
    warnings: [],
  };

  const assignments: SlotAssignment[] = [];

  // Build lookup sets
  const excludedSlots = new Set(exclusions.map((e) => `${e.day}:${e.mealTime}`));
  const pinMap = new Map(pins.map((p) => [`${p.day}:${p.mealTime}`, p.tagId]));

  // Track assignments for cooldown/frequency (maps date+recipeId -> slot index)
  // assignedRecipes: slotIndex -> recipeId assigned at that slot
  const assignedRecipes: Map<number, string> = new Map();
  // assignedDates: slotIndex -> date of the slot
  const assignedDates: Map<number, Date> = new Map();
  // tagCounters: tagId -> count per frequency window
  // (we'll track globally and compute per-window at the end)
  const assignedTagsBySlotIndex: Map<number, string[]> = new Map();

  // Sort slots chronologically (should already be, but ensure)
  const sortedSlots = [...slots].sort((a, b) => {
    const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (dateDiff !== 0) return dateDiff;
    return a.mealTime === "LUNCH" ? -1 : 1;
  });

  // =============================================
  // PASS 1: Main pass
  // =============================================
  for (let i = 0; i < sortedSlots.length; i++) {
    const slot = sortedSlots[i];
    const slotDay = dateToDayOfWeek(slot.date);
    const slotKey = `${slotDay}:${slot.mealTime}`;

    // 1. Skip disabled
    if (slot.disabled) {
      report.slotsSkipped.disabled++;
      continue;
    }

    // 2. Skip excluded
    if (excludedSlots.has(slotKey)) {
      report.slotsSkipped.excluded++;
      continue;
    }

    // 3. Skip locked
    if (slot.locked) {
      report.slotsSkipped.locked++;
      // Track locked slot's recipe for cooldown tracking
      if (slot.recipeId) {
        assignedRecipes.set(i, slot.recipeId);
        assignedDates.set(i, slot.date);
      }
      continue;
    }

    // 4. Skip if fillEmptyOnly and not empty
    if (fillEmptyOnly && slot.type !== "EMPTY") {
      report.slotsSkipped.alreadyFilled++;
      // Track existing slot's recipe for cooldown tracking
      if (slot.recipeId) {
        assignedRecipes.set(i, slot.recipeId);
        assignedDates.set(i, slot.date);
      }
      continue;
    }

    // 5. Build eligible pool
    let eligible = [...pool];

    // 6. Apply pin filter
    const pinnedTagId = pinMap.get(slotKey);
    if (pinnedTagId) {
      eligible = eligible.filter((e) => e.tagIds.includes(pinnedTagId));
    }

    // 7-8-9-10. Filter by cooldown and frequency, then compute weights
    eligible = applyCooldownRecipe(
      eligible,
      i,
      slot,
      sortedSlots,
      assignedRecipes,
      assignedDates,
      previousSlots,
      params.cooldownDays
    );
    eligible = applyCooldownTag(
      eligible,
      i,
      slot,
      sortedSlots,
      assignedRecipes,
      assignedDates,
      assignedTagsBySlotIndex,
      previousSlots,
      rules,
      pool
    );
    eligible = applyFrequencyMax(
      eligible,
      i,
      sortedSlots,
      assignedTagsBySlotIndex,
      rules,
      params,
      pinnedTagId,
      report
    );

    // 11. Compute weights
    const weights = eligible.map((entry) => computeWeight(entry, slot.mealTime, rules));

    // Filter out weight=0 entries
    const finalEntries: PoolEntry[] = [];
    const finalWeights: number[] = [];
    for (let j = 0; j < eligible.length; j++) {
      if (weights[j] > 0) {
        finalEntries.push(eligible[j]);
        finalWeights.push(weights[j]);
      }
    }

    // 12. Weighted random pick
    const picked = weightedRandomPick(finalEntries, finalWeights);

    if (!picked) {
      // Pool exhausted
      report.slotsEmpty++;
      report.warnings.push({
        type: "POOL_EXHAUSTED",
        slotDay,
        slotMealTime: slot.mealTime,
        reason: "All recipes excluded by cooldown and frequency constraints",
      });
      assignments.push({
        slotId: slot.id,
        recipeId: null,
        type: "EMPTY",
        weight: 0,
      });
      continue;
    }

    // 13. Write assignment
    const pickedWeight = finalWeights[finalEntries.indexOf(picked)];
    if (picked.type === "IDEA" && !picked.recipeId) {
      // MealIdea sans recette -> FREE_TEXT
      assignments.push({
        slotId: slot.id,
        recipeId: null,
        type: "FREE_TEXT",
        freeText: picked.freeText,
        comment: picked.comment,
        weight: pickedWeight,
      });
    } else {
      assignments.push({
        slotId: slot.id,
        recipeId: picked.recipeId,
        type: "RECIPE",
        weight: pickedWeight,
      });
    }

    // Track for subsequent slots
    if (picked.recipeId) {
      assignedRecipes.set(i, picked.recipeId);
    }
    assignedDates.set(i, slot.date);
    assignedTagsBySlotIndex.set(i, picked.tagIds);

    report.slotsGenerated++;
  }

  // =============================================
  // PASS 2: Frequency min catch-up (Phase 5)
  // =============================================
  runFrequencyMinCatchUp(
    sortedSlots,
    assignments,
    assignedRecipes,
    assignedDates,
    assignedTagsBySlotIndex,
    excludedSlots,
    pinMap,
    rules,
    params,
    pool,
    previousSlots,
    report
  );

  return { assignments, report };
}

// =============================================
// Cooldown recette (global + cross-planning)
// =============================================

function applyCooldownRecipe(
  eligible: PoolEntry[],
  slotIndex: number,
  slot: SlotInfo,
  sortedSlots: SlotInfo[],
  assignedRecipes: Map<number, string>,
  assignedDates: Map<number, Date>,
  previousSlots: PreviousSlotInfo[],
  cooldownDays: number
): PoolEntry[] {
  if (cooldownDays <= 0) return eligible;

  const cooldownRecipeIds = new Set<string>();

  // Intra-generation: check previously assigned slots
  for (let j = 0; j < slotIndex; j++) {
    const rid = assignedRecipes.get(j);
    const date = assignedDates.get(j);
    if (rid && date) {
      const dist = daysBetween(date, slot.date);
      if (dist <= cooldownDays) {
        cooldownRecipeIds.add(rid);
      }
    }
  }

  // Cross-planning: check previous archived plan slots
  for (const prev of previousSlots) {
    if (prev.recipeId) {
      const dist = daysBetween(prev.date, slot.date);
      if (dist <= cooldownDays) {
        cooldownRecipeIds.add(prev.recipeId);
      }
    }
  }

  return eligible.filter((e) => !e.recipeId || !cooldownRecipeIds.has(e.recipeId));
}

// =============================================
// Cooldown tag (per rule + cross-planning)
// =============================================

function applyCooldownTag(
  eligible: PoolEntry[],
  slotIndex: number,
  slot: SlotInfo,
  sortedSlots: SlotInfo[],
  assignedRecipes: Map<number, string>,
  assignedDates: Map<number, Date>,
  assignedTagsBySlotIndex: Map<number, string[]>,
  previousSlots: PreviousSlotInfo[],
  rules: MealGenerationRule[],
  _pool: PoolEntry[]
): PoolEntry[] {
  // Find tag rules with tagCooldownDays set
  const tagCooldownRules = rules.filter(
    (r) => r.tagId && r.tagCooldownDays != null && r.tagCooldownDays > 0
  );
  if (tagCooldownRules.length === 0) return eligible;

  const cooldownTagIds = new Set<string>();

  for (const rule of tagCooldownRules) {
    const tagId = rule.tagId!;
    const cooldownDays = rule.tagCooldownDays!;

    // Intra-generation
    for (let j = 0; j < slotIndex; j++) {
      const date = assignedDates.get(j);
      const tags = assignedTagsBySlotIndex.get(j);
      if (date && tags && tags.includes(tagId)) {
        const dist = daysBetween(date, slot.date);
        if (dist <= cooldownDays) {
          cooldownTagIds.add(tagId);
          break;
        }
      }
    }

    // Cross-planning
    for (const prev of previousSlots) {
      if (prev.tagIds.includes(tagId)) {
        const dist = daysBetween(prev.date, slot.date);
        if (dist <= cooldownDays) {
          cooldownTagIds.add(tagId);
          break;
        }
      }
    }
  }

  if (cooldownTagIds.size === 0) return eligible;

  return eligible.filter((e) => {
    // Ideas sans recette ne sont pas affectees par le tag cooldown
    if (e.tagIds.length === 0) return true;
    // Exclure si l'entree a un tag en cooldown
    return !e.tagIds.some((t) => cooldownTagIds.has(t));
  });
}

// =============================================
// Frequency max (per tag per window)
// =============================================

function applyFrequencyMax(
  eligible: PoolEntry[],
  slotIndex: number,
  sortedSlots: SlotInfo[],
  assignedTagsBySlotIndex: Map<number, string[]>,
  rules: (MealGenerationRule & { tag?: { id: string; name: string } | null })[],
  params: MealGenerationParams,
  pinnedTagId: string | undefined,
  report: GenerationReport
): PoolEntry[] {
  const freqMaxRules = rules.filter((r) => r.tagId && r.frequencyMax != null);
  if (freqMaxRules.length === 0) return eligible;

  const slot = sortedSlots[slotIndex];
  const excludedTagIds = new Set<string>();

  for (const rule of freqMaxRules) {
    const tagId = rule.tagId!;
    const maxCount = rule.frequencyMax!;
    const per = rule.frequencyPer || "PER_WEEK";

    // Count current occurrences in the appropriate window
    let count = 0;
    for (let j = 0; j < slotIndex; j++) {
      const tags = assignedTagsBySlotIndex.get(j);
      if (!tags || !tags.includes(tagId)) continue;

      if (per === "PER_PLANNING") {
        count++;
      } else {
        // PER_WEEK: same 7-day tranche
        const slotDate = new Date(sortedSlots[j].date);
        const startDate = new Date(sortedSlots[0].date);
        const currentDate = new Date(slot.date);
        const slotWeek = Math.floor(daysBetween(startDate, slotDate) / 7);
        const currentWeek = Math.floor(daysBetween(startDate, currentDate) / 7);
        if (slotWeek === currentWeek) count++;
      }
    }

    if (count >= maxCount) {
      // If this tag is pinned for this slot, we can't exclude it - add warning
      if (pinnedTagId === tagId) {
        report.warnings.push({
          type: "FREQUENCY_MAX_EXCEEDED",
          tagId,
          tagName: rule.tag?.name,
          required: maxCount,
          actual: count + 1,
          reason: "Pin forces tag beyond frequencyMax",
        });
      } else {
        excludedTagIds.add(tagId);
      }
    }
  }

  if (excludedTagIds.size === 0) return eligible;

  return eligible.filter((e) => {
    if (e.tagIds.length === 0) return true;
    return !e.tagIds.some((t) => excludedTagIds.has(t));
  });
}

// =============================================
// Weight computation
// =============================================

function computeWeight(
  entry: PoolEntry,
  slotMealTime: MealTime,
  rules: MealGenerationRule[]
): number {
  // Ideas sans recette: poids base 1.0, pas de regles
  if (entry.tagIds.length === 0 && !entry.recipeId) return 1.0;

  let weight = 1.0;

  for (const rule of rules) {
    // Check mealTimeConstraint
    if (rule.mealTimeConstraint && rule.mealTimeConstraint !== slotMealTime) continue;

    // Tag rule
    if (rule.tagId && entry.tagIds.includes(rule.tagId)) {
      weight *= rule.weight;
    }

    // Recipe rule
    if (rule.recipeId && entry.recipeId === rule.recipeId) {
      weight *= rule.weight;
    }
  }

  return weight;
}

// =============================================
// PASS 2: Frequency min catch-up
// =============================================

function runFrequencyMinCatchUp(
  sortedSlots: SlotInfo[],
  assignments: SlotAssignment[],
  assignedRecipes: Map<number, string>,
  assignedDates: Map<number, Date>,
  assignedTagsBySlotIndex: Map<number, string[]>,
  excludedSlots: Set<string>,
  pinMap: Map<string, string>,
  rules: (MealGenerationRule & { tag?: { id: string; name: string } | null })[],
  params: MealGenerationParams,
  pool: PoolEntry[],
  previousSlots: PreviousSlotInfo[],
  report: GenerationReport
): void {
  const freqMinRules = rules.filter((r) => r.tagId && r.frequencyMin != null && r.frequencyMin > 0);
  if (freqMinRules.length === 0) return;

  // Build assignment lookup: slotId -> assignment
  const assignmentMap = new Map(assignments.map((a) => [a.slotId, a]));
  const startDate = new Date(sortedSlots[0].date);

  for (const rule of freqMinRules) {
    const tagId = rule.tagId!;
    const minCount = rule.frequencyMin!;
    const per = rule.frequencyPer || "PER_WEEK";

    // Determine windows
    const windows = getFrequencyWindows(sortedSlots, per, startDate);

    for (const window of windows) {
      // Count current occurrences of this tag in this window
      let count = 0;
      for (const idx of window.slotIndices) {
        const tags = assignedTagsBySlotIndex.get(idx);
        if (tags && tags.includes(tagId)) count++;
      }

      if (count >= minCount) continue; // Already met

      const deficit = minCount - count;

      // Find replaceable slots in this window:
      // non-locked, non-excluded, non-pinned, not already having this tag
      const replaceableCandidates: { slotIdx: number; weight: number }[] = [];
      for (const idx of window.slotIndices) {
        const slot = sortedSlots[idx];
        const slotDay = dateToDayOfWeek(slot.date);
        const slotKey = `${slotDay}:${slot.mealTime}`;

        if (slot.disabled || slot.locked || excludedSlots.has(slotKey)) continue;
        if (pinMap.has(slotKey)) continue;

        const assignment = assignmentMap.get(slot.id);
        if (!assignment) continue;
        if (assignment.type === "EMPTY") continue; // Can't replace empty with tagged recipe

        // Skip if this slot already has the tag
        const slotTags = assignedTagsBySlotIndex.get(idx);
        if (slotTags && slotTags.includes(tagId)) continue;

        replaceableCandidates.push({ slotIdx: idx, weight: assignment.weight });
      }

      // Sort by weight ascending (replace least important first)
      replaceableCandidates.sort((a, b) => a.weight - b.weight);

      let replaced = 0;
      for (const candidate of replaceableCandidates) {
        if (replaced >= deficit) break;

        const slot = sortedSlots[candidate.slotIdx];

        // Find a recipe with this tag that respects cooldown
        const taggedPool = pool.filter((e) => e.tagIds.includes(tagId) && e.recipeId);
        const eligibleForReplace = applyCooldownRecipe(
          taggedPool,
          candidate.slotIdx,
          slot,
          sortedSlots,
          assignedRecipes,
          assignedDates,
          previousSlots,
          params.cooldownDays
        );

        if (eligibleForReplace.length === 0) continue;

        // Check frequencyMax for the tag we're adding wouldn't be exceeded
        // (simplified: just pick one)
        const weights = eligibleForReplace.map((e) => computeWeight(e, slot.mealTime, rules));
        const positiveEntries: PoolEntry[] = [];
        const positiveWeights: number[] = [];
        for (let j = 0; j < eligibleForReplace.length; j++) {
          if (weights[j] > 0) {
            positiveEntries.push(eligibleForReplace[j]);
            positiveWeights.push(weights[j]);
          }
        }

        const picked = weightedRandomPick(positiveEntries, positiveWeights);
        if (!picked) continue;

        // Replace the assignment
        const assignment = assignmentMap.get(slot.id)!;
        assignment.recipeId = picked.recipeId;
        assignment.type = "RECIPE";
        assignment.freeText = null;
        assignment.comment = null;
        assignment.weight = positiveWeights[positiveEntries.indexOf(picked)];

        // Update tracking
        if (picked.recipeId) {
          assignedRecipes.set(candidate.slotIdx, picked.recipeId);
        }
        assignedTagsBySlotIndex.set(candidate.slotIdx, picked.tagIds);

        replaced++;
      }

      const finalCount = count + replaced;
      if (finalCount < minCount) {
        report.warnings.push({
          type: "FREQUENCY_MIN_NOT_MET",
          tagId,
          tagName: rule.tag?.name,
          required: minCount,
          actual: finalCount,
          reason: "Not enough eligible recipes with this tag",
        });
      }
    }
  }
}

/** Get frequency windows (slotIndices per window) */
function getFrequencyWindows(
  sortedSlots: SlotInfo[],
  per: FrequencyPer | string,
  startDate: Date
): { slotIndices: number[] }[] {
  if (per === "PER_PLANNING") {
    return [{ slotIndices: sortedSlots.map((_, i) => i) }];
  }

  // PER_WEEK: group by 7-day tranches from startDate
  const windowMap = new Map<number, number[]>();
  for (let i = 0; i < sortedSlots.length; i++) {
    const week = Math.floor(daysBetween(startDate, sortedSlots[i].date) / 7);
    if (!windowMap.has(week)) windowMap.set(week, []);
    windowMap.get(week)!.push(i);
  }

  return Array.from(windowMap.values()).map((indices) => ({ slotIndices: indices }));
}
