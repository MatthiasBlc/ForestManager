// Generation du planning [D110, D113, D184] : charge la situation (reglages,
// profil resolu, pool, idees, repas de la periode et autour), appelle le domaine
// pur, puis met en forme. L'apercu n'ecrit rien ; "Garder" n'ecrase pas une case
// modifiee depuis le tirage ; "Proposer un autre repas" ecrit une seule case.
import type {
  ApplyGenerationBody,
  ApplyGenerationResult,
  EmptyReason,
  GenerationPreview,
  MealCell,
  SuggestMealResult,
} from "@fm/shared";

import type { Context } from "../../core/context.ts";
import { Prisma } from "../../core/db/client.ts";
import { AppError } from "../../core/http/errors.ts";
import { requiredService, type PoolRecipeInfo } from "../services.ts";
import {
  generate,
  type EmptyReason as DomainReason,
  type ExistingMeal,
  type GenerationResult,
  type MealPick,
  type PlacedMeal,
} from "./domain/generate.ts";
import {
  assertPlanned,
  cellWhere,
  mealSelect,
  present,
  toDbDate,
  toIsoDate,
  type MealRow,
} from "./meals.ts";
import { defaultProfileId, resolveProfile, tagNames, type ResolvedProfile } from "./profiles.ts";
import { readSettings } from "./settings.ts";

const DAY_MS = 86_400_000;
const shift = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

interface Situation {
  profile: ResolvedProfile;
  pool: Map<string, PoolRecipeInfo>;
  ideas: Map<string, { id: string; name: string; comment: string | null }>;
  mealTimes: readonly ("LUNCH" | "DINNER")[];
  weekStartsOn: Parameters<typeof generate>[0]["weekStartsOn"];
  /** Repas ecrits de la periode, par case. */
  inPeriod: Map<
    string,
    {
      kind: ExistingMeal["kind"];
      recipeId: string | null;
      text: string | null;
      locked: boolean;
      updatedAt: Date;
    }
  >;
  context: PlacedMeal[];
}

const key = (date: string, mealTime: string) => `${date}/${mealTime}`;

async function loadSituation(
  ctx: Context,
  spaceId: string,
  profileId: string,
  from: string,
  to: string
): Promise<Situation> {
  const settings = await readSettings(ctx.db, spaceId);
  const poolRows = await requiredService(ctx, "recipes.catalog").pool(spaceId);
  const pool = new Map(poolRows.map((recipe) => [recipe.id, recipe]));
  const profile = await resolveProfile(ctx.db, spaceId, profileId, new Set(pool.keys()));
  // Autour de la periode : les delais, et les semaines a cheval pour les frequences.
  const gap = Math.max(
    6,
    profile.input.cooldownDays,
    ...profile.input.rules.map((rule) => rule.tagCooldownDays ?? 0)
  );
  const [rows, ideaRows] = await Promise.all([
    ctx.db.mealSlot.findMany({
      where: {
        spaceId,
        date: { gte: toDbDate(shift(from, -gap)), lte: toDbDate(shift(to, gap)) },
      },
      select: {
        date: true,
        mealTime: true,
        kind: true,
        recipeId: true,
        text: true,
        locked: true,
        updatedAt: true,
      },
    }),
    ctx.db.mealIdea.findMany({
      where: { spaceId, deletedAt: null },
      select: { id: true, name: true, comment: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const inPeriod: Situation["inPeriod"] = new Map();
  const context: PlacedMeal[] = [];
  for (const row of rows) {
    const date = toIsoDate(row.date);
    if (date >= from && date <= to) {
      inPeriod.set(key(date, row.mealTime), row);
    } else if (row.kind === "RECIPE" && row.recipeId) {
      context.push({
        date,
        mealTime: row.mealTime,
        recipeId: row.recipeId,
        tagIds: pool.get(row.recipeId)?.tagIds ?? [],
      });
    }
  }
  return {
    profile,
    pool,
    ideas: new Map(ideaRows.map((idea) => [idea.id, idea])),
    mealTimes: settings.mealTimes,
    weekStartsOn: settings.weekStartsOn,
    inPeriod,
    context,
  };
}

function run(situation: Situation, from: string, to: string, replace: boolean): GenerationResult {
  const meals = [...situation.inPeriod.entries()].map(([cell, row]): ExistingMeal => {
    const [date = "", mealTime = "LUNCH"] = cell.split("/");
    return {
      date,
      mealTime: mealTime as ExistingMeal["mealTime"],
      kind: row.kind,
      recipeId: row.recipeId,
      tagIds: row.recipeId ? (situation.pool.get(row.recipeId)?.tagIds ?? []) : [],
      locked: row.locked,
    };
  });
  return generate({
    from,
    to,
    mealTimes: situation.mealTimes,
    weekStartsOn: situation.weekStartsOn,
    meals,
    context: situation.context,
    profile: situation.profile.input,
    recipes: [...situation.pool.values()],
    ideas: [...situation.ideas.values()],
    replace,
    random: Math.random,
  });
}

/** Tags cites par les raisons et les avertissements, avec leur nom. */
async function namesFor(ctx: Context, result: GenerationResult) {
  const ids = [
    ...result.proposals.flatMap((p) => {
      const reason = p.reason;
      if (!reason) return [];
      if (reason.code === "PIN") return [reason.tagId];
      if (reason.code === "TAG_COOLDOWN" || reason.code === "FREQUENCY_MAX") return reason.tagIds;
      return [];
    }),
    ...result.warnings.map((warning) => warning.tagId),
  ];
  const names = await tagNames(ctx.db, ids);
  return (id: string) => ({ id, name: names.get(id) ?? "" });
}

function reasonView(
  reason: DomainReason,
  tag: (id: string) => { id: string; name: string }
): EmptyReason {
  switch (reason.code) {
    case "PIN":
      return { code: "PIN", tag: tag(reason.tagId) };
    case "TAG_COOLDOWN":
    case "FREQUENCY_MAX":
      return { code: reason.code, tags: reason.tagIds.map(tag) };
    default:
      return reason;
  }
}

export async function previewGeneration(
  ctx: Context,
  spaceId: string,
  body: { profileId: string; from: string; to: string; replace: boolean }
): Promise<GenerationPreview> {
  const situation = await loadSituation(ctx, spaceId, body.profileId, body.from, body.to);
  const result = run(situation, body.from, body.to, body.replace);
  const tag = await namesFor(ctx, result);
  return {
    profile: { id: situation.profile.id, name: situation.profile.name },
    from: body.from,
    to: body.to,
    replace: body.replace,
    proposals: result.proposals.map((p) => {
      const seen = situation.inPeriod.get(key(p.date, p.mealTime));
      const recipe = p.pick?.kind === "RECIPE" ? situation.pool.get(p.pick.id) : undefined;
      const idea = p.pick?.kind === "IDEA" ? situation.ideas.get(p.pick.id) : undefined;
      return {
        date: p.date,
        mealTime: p.mealTime,
        pick: recipe
          ? { kind: "RECIPE", recipe: { id: recipe.id, title: recipe.title } }
          : idea
            ? { kind: "IDEA", idea: { id: idea.id, name: idea.name } }
            : null,
        reason: p.reason ? reasonView(p.reason, tag) : null,
        kept:
          p.keeps && seen
            ? {
                text:
                  (seen.recipeId ? situation.pool.get(seen.recipeId)?.title : undefined) ??
                  seen.text ??
                  "",
              }
            : null,
        seenUpdatedAt: seen ? seen.updatedAt.toISOString() : null,
      };
    }),
    skipped: result.skipped,
    warnings: result.warnings.map((warning) =>
      warning.code === "MIN_NOT_MET"
        ? {
            code: warning.code,
            tag: tag(warning.tagId),
            required: warning.required,
            actual: warning.actual,
            from: warning.from,
            to: warning.to,
          }
        : {
            code: warning.code,
            tag: tag(warning.tagId),
            max: warning.max,
            actual: warning.actual,
            from: warning.from,
            to: warning.to,
          }
    ),
  };
}

/** Contenu ecrit pour un choix de la generation (non verrouille, portions par defaut). */
async function contentOf(
  ctx: Context,
  spaceId: string,
  viewerId: string,
  pick: { kind: "RECIPE"; recipeId: string } | { kind: "IDEA"; ideaId: string }
) {
  if (pick.kind === "RECIPE") {
    const found = await requiredService(ctx, "recipes.catalog").visible(spaceId, viewerId, [
      pick.recipeId,
    ]);
    const recipe = found.get(pick.recipeId);
    if (!recipe) return null;
    return { kind: "RECIPE" as const, recipeId: recipe.id, text: recipe.title, comment: null };
  }
  const idea = await ctx.db.mealIdea.findFirst({
    where: { id: pick.ideaId, spaceId, deletedAt: null },
    select: { name: true, comment: true },
  });
  if (!idea) return null;
  return { kind: "TEXT" as const, recipeId: null, text: idea.name, comment: idea.comment };
}

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

export async function applyGeneration(
  ctx: Context,
  spaceId: string,
  userId: string,
  body: ApplyGenerationBody
): Promise<ApplyGenerationResult> {
  await assertPlanned(ctx, spaceId, body.cells);
  const written: MealRow[] = [];
  const conflicts: MealCell[] = [];
  for (const cell of body.cells) {
    const target = { date: cell.date, mealTime: cell.mealTime };
    const content = await contentOf(ctx, spaceId, userId, cell.pick);
    let done = false;
    if (content) {
      const data = { ...content, servings: null, locked: false, updatedById: userId };
      if (cell.seenUpdatedAt === null) {
        try {
          written.push(
            await ctx.db.mealSlot.create({
              data: { spaceId, date: toDbDate(cell.date), mealTime: cell.mealTime, ...data },
              select: mealSelect,
            })
          );
          done = true;
        } catch (error) {
          if (!isUniqueViolation(error)) throw error;
        }
      } else {
        // Ecrit seulement si la case n'a pas bouge depuis le tirage (ni verrouillee).
        const { count } = await ctx.db.mealSlot.updateMany({
          where: {
            spaceId,
            date: toDbDate(cell.date),
            mealTime: cell.mealTime,
            updatedAt: new Date(cell.seenUpdatedAt),
            locked: false,
          },
          data,
        });
        if (count === 1) {
          written.push(
            await ctx.db.mealSlot.findUniqueOrThrow({
              where: cellWhere(spaceId, target),
              select: mealSelect,
            })
          );
          done = true;
        }
      }
    }
    if (!done) conflicts.push(target);
  }
  return { data: await present(ctx, spaceId, userId, written), conflicts };
}

/** "Proposer un autre repas" : profil par defaut, repas actuel ecarte, exclusions ignorees. */
export async function suggestMeal(
  ctx: Context,
  spaceId: string,
  userId: string,
  cell: MealCell
): Promise<SuggestMealResult> {
  await assertPlanned(ctx, spaceId, [cell]);
  const current = await ctx.db.mealSlot.findUnique({
    where: cellWhere(spaceId, cell),
    select: { kind: true, recipeId: true, text: true, locked: true },
  });
  if (current?.locked) throw new AppError("MEAL_009");
  const profileId = await defaultProfileId(ctx.db, spaceId);
  const situation = await loadSituation(ctx, spaceId, profileId, cell.date, cell.date);
  // Les autres repas du jour comptent comme deja places.
  for (const [other, row] of situation.inPeriod) {
    const [date = "", mealTime = "LUNCH"] = other.split("/");
    if (other === key(cell.date, cell.mealTime) || row.kind !== "RECIPE" || !row.recipeId) continue;
    situation.context.push({
      date,
      mealTime: mealTime as PlacedMeal["mealTime"],
      recipeId: row.recipeId,
      tagIds: situation.pool.get(row.recipeId)?.tagIds ?? [],
    });
  }
  const avoid: MealPick | undefined =
    current?.kind === "RECIPE" && current.recipeId
      ? { kind: "RECIPE", id: current.recipeId }
      : undefined;
  const result = generate({
    from: cell.date,
    to: cell.date,
    mealTimes: [cell.mealTime],
    weekStartsOn: situation.weekStartsOn,
    meals: [],
    context: situation.context,
    profile: { ...situation.profile.input, exclusions: [] },
    recipes: [...situation.pool.values()],
    ideas: [...situation.ideas.values()].filter(
      // Une idee deja ecrite dans cette case n'est pas reproposee.
      (idea) => !(current?.kind === "TEXT" && current.text === idea.name)
    ),
    replace: true,
    random: Math.random,
    ...(avoid ? { avoid } : {}),
  });
  const proposal = result.proposals[0];
  if (!proposal?.pick) {
    const tag = await namesFor(ctx, result);
    return {
      meal: null,
      reason: proposal?.reason ? reasonView(proposal.reason, tag) : { code: "NO_RECIPE" },
    };
  }
  const content = await contentOf(
    ctx,
    spaceId,
    userId,
    proposal.pick.kind === "RECIPE"
      ? { kind: "RECIPE", recipeId: proposal.pick.id }
      : { kind: "IDEA", ideaId: proposal.pick.id }
  );
  if (!content) return { meal: null, reason: { code: "NO_RECIPE" } };
  const data = { ...content, servings: null, locked: false, updatedById: userId };
  const row = await ctx.db.mealSlot.upsert({
    where: cellWhere(spaceId, cell),
    create: { spaceId, date: toDbDate(cell.date), mealTime: cell.mealTime, ...data },
    update: data,
    select: mealSelect,
  });
  const [meal] = await present(ctx, spaceId, userId, [row]);
  return { meal: meal ?? null, reason: null };
}
