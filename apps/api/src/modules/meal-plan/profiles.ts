// Profils de generation [D183, D184, D114] : toujours au moins un profil et
// exactement un par defaut ("Standard" cree au premier acces) ; regles sur un tag
// (global ou de l'espace) ou une recette visible ; grille jours x repas des
// exclusions et epinglages. Un tag fusionne suit sa cible, un tag supprime est
// signale ; une recette devenue invisible laisse une regle sans titre.
import {
  MAX_PROFILES,
  MAX_RULES,
  MEAL_TIMES,
  PROFILE_NAME_MAX,
  WEEKDAYS,
  type GridCell,
  type GenerationProfile,
  type GenerationProfileSummary,
  type PutGridBody,
  type Rule,
  type RuleTag,
  type createGenerationProfileBodySchema,
  type ruleBodySchema,
  type updateGenerationProfileBodySchema,
} from "@fm/shared";
import type { z } from "zod";

import type { Context } from "../../core/context.ts";
import { Prisma, type Db } from "../../core/db/client.ts";
import { AppError } from "../../core/http/errors.ts";
import { requiredService } from "../services.ts";

type Tx = Parameters<Parameters<Db["$transaction"]>[0]>[0];
type CreateInput = z.output<typeof createGenerationProfileBodySchema>;
type UpdateInput = z.output<typeof updateGenerationProfileBodySchema>;
type RuleInput = z.output<typeof ruleBodySchema>;

const LOCALE = "fr"; // francais seul en V2.0 [D34]
const STANDARD = { name: "Standard", isDefault: true } as const;
/** Une chaine de fusions ne depasse pas quelques maillons ; borne de securite. */
const MAX_MERGE_HOPS = 8;

const live = { deletedAt: null } as const;

/** Profils actifs de l'espace ; cree "Standard" s'il n'y en a aucun [D183]. */
export async function ensureProfiles(db: Db, spaceId: string): Promise<void> {
  if ((await db.mealGenerationProfile.count({ where: { spaceId, ...live } })) > 0) return;
  try {
    await db.mealGenerationProfile.create({ data: { spaceId, ...STANDARD } });
  } catch (error) {
    // Deux premiers acces simultanes : l'index partiel du defaut n'en garde qu'un.
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) {
      throw error;
    }
  }
}

export async function listProfiles(db: Db, spaceId: string): Promise<GenerationProfileSummary[]> {
  await ensureProfiles(db, spaceId);
  const rows = await db.mealGenerationProfile.findMany({
    where: { spaceId, ...live },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      isDefault: true,
      _count: { select: { rules: true } },
    },
  });
  return rows.map(({ _count, ...row }) => ({ ...row, ruleCount: _count.rules }));
}

async function findProfile(db: Db | Tx, spaceId: string, profileId: string) {
  const profile = await db.mealGenerationProfile.findFirst({
    where: { id: profileId, spaceId, ...live },
  });
  if (!profile) throw new AppError("MEAL_003");
  return profile;
}

// --- Tags et recettes vus par un profil ---

interface TagRow {
  id: string;
  name: string;
  mergedIntoId: string | null;
  deletedAt: Date | null;
  translations: { name: string }[];
}

async function loadTags(db: Db, ids: Iterable<string>): Promise<Map<string, TagRow>> {
  const found = new Map<string, TagRow>();
  let pending = [...new Set(ids)];
  for (let hop = 0; hop < MAX_MERGE_HOPS && pending.length > 0; hop++) {
    const rows = await db.tag.findMany({
      where: { id: { in: pending } },
      select: {
        id: true,
        name: true,
        mergedIntoId: true,
        deletedAt: true,
        translations: { where: { locale: LOCALE }, select: { name: true } },
      },
    });
    for (const row of rows) found.set(row.id, row);
    pending = rows.flatMap((row) =>
      row.mergedIntoId && !found.has(row.mergedIntoId) ? [row.mergedIntoId] : []
    );
  }
  return found;
}

/** Suit les fusions jusqu'au tag vivant ; sinon le dernier tag, signale supprime. */
function resolveTag(tags: Map<string, TagRow>, id: string): RuleTag {
  let tag = tags.get(id);
  for (let hop = 0; tag?.mergedIntoId && hop < MAX_MERGE_HOPS; hop++) {
    const next = tags.get(tag.mergedIntoId);
    if (!next) break;
    tag = next;
  }
  if (!tag) return { id, name: "", status: "DELETED" };
  return {
    id: tag.id,
    name: tag.translations[0]?.name ?? tag.name,
    status: tag.deletedAt ? "DELETED" : "ACTIVE",
  };
}

/** Tag utilisable par l'espace : global ou de l'espace, ni fusionne ni supprime. */
async function assertUsableTag(db: Db | Tx, spaceId: string, tagId: string): Promise<void> {
  const tag = await db.tag.findFirst({
    where: {
      id: tagId,
      deletedAt: null,
      mergedIntoId: null,
      OR: [{ scope: "GLOBAL" }, { scope: "SPACE", spaceId }],
    },
    select: { id: true },
  });
  if (!tag) throw new AppError("RECIPE_003");
}

// --- Lecture du detail ---

const WEEKDAY_ORDER = new Map(WEEKDAYS.map((day, index) => [day, index]));
const MEAL_ORDER = new Map(MEAL_TIMES.map((time, index) => [time, index]));

export async function readProfile(
  ctx: Context,
  spaceId: string,
  viewerId: string,
  profileId: string
): Promise<GenerationProfile> {
  const profile = await findProfile(ctx.db, spaceId, profileId);
  const [rules, exclusions, pins] = await Promise.all([
    ctx.db.mealGenerationRule.findMany({
      where: { profileId },
      orderBy: [{ position: "asc" }, { id: "asc" }],
    }),
    ctx.db.mealSlotExclusion.findMany({ where: { profileId } }),
    ctx.db.mealSlotPin.findMany({ where: { profileId } }),
  ]);
  const tags = await loadTags(ctx.db, [
    ...rules.flatMap((rule) => (rule.tagId ? [rule.tagId] : [])),
    ...pins.map((pin) => pin.tagId),
  ]);
  const recipeIds = rules.flatMap((rule) => (rule.recipeId ? [rule.recipeId] : []));
  const recipes = await requiredService(ctx, "recipes.catalog").visible(
    spaceId,
    viewerId,
    recipeIds
  );

  const presented = rules.flatMap((rule): Rule[] => {
    const target: Rule["target"] | null = rule.tagId
      ? { kind: "TAG", tag: resolveTag(tags, rule.tagId) }
      : rule.recipeId
        ? {
            kind: "RECIPE",
            recipe: { id: rule.recipeId, title: recipes.get(rule.recipeId)?.title ?? null },
          }
        : null;
    if (!target) return [];
    return [
      {
        id: rule.id,
        target,
        weight: rule.weight,
        mealTime: rule.mealTime,
        frequencyMin: rule.frequencyMin,
        frequencyMax: rule.frequencyMax,
        frequencyPer: rule.frequencyPer,
        tagCooldownDays: rule.tagCooldownDays,
      },
    ];
  });

  const grid: GridCell[] = [
    ...exclusions.map((cell): GridCell => ({ ...pick(cell), state: "EXCLUDED" })),
    ...pins.map((pin): GridCell => ({
      ...pick(pin),
      state: "PINNED",
      tag: resolveTag(tags, pin.tagId),
    })),
  ].sort(
    (a, b) =>
      (WEEKDAY_ORDER.get(a.weekday) ?? 0) - (WEEKDAY_ORDER.get(b.weekday) ?? 0) ||
      (MEAL_ORDER.get(a.mealTime) ?? 0) - (MEAL_ORDER.get(b.mealTime) ?? 0)
  );

  return {
    id: profile.id,
    name: profile.name,
    description: profile.description,
    isDefault: profile.isDefault,
    ruleCount: presented.length,
    cooldownDays: profile.cooldownDays,
    useIdeas: profile.useIdeas,
    rules: presented,
    grid,
  };
}

const pick = (cell: Pick<GridCell, "weekday" | "mealTime">) => ({
  weekday: cell.weekday,
  mealTime: cell.mealTime,
});

// --- Ecritures sur le profil ---

async function assertRoomForProfile(db: Db | Tx, spaceId: string): Promise<void> {
  const count = await db.mealGenerationProfile.count({ where: { spaceId, ...live } });
  if (count >= MAX_PROFILES) throw new AppError("MEAL_007");
}

export async function createProfile(db: Db, spaceId: string, body: CreateInput): Promise<string> {
  await ensureProfiles(db, spaceId);
  await assertRoomForProfile(db, spaceId);
  const profile = await db.mealGenerationProfile.create({
    data: { spaceId, name: body.name, description: body.description },
    select: { id: true },
  });
  return profile.id;
}

export async function updateProfile(
  db: Db,
  spaceId: string,
  profileId: string,
  body: UpdateInput
): Promise<void> {
  await db.$transaction(async (tx) => {
    await findProfile(tx, spaceId, profileId);
    if (body.isDefault) {
      await tx.mealGenerationProfile.updateMany({
        where: { spaceId, isDefault: true, id: { not: profileId } },
        data: { isDefault: false },
      });
    }
    await tx.mealGenerationProfile.update({
      where: { id: profileId },
      data: {
        name: body.name,
        // Absente : inchangee ; vide ou null : effacee.
        ...(body.description !== undefined ? { description: body.description } : {}),
        cooldownDays: body.cooldownDays,
        useIdeas: body.useIdeas,
        ...(body.isDefault ? { isDefault: true } : {}),
      },
    });
  });
}

export async function duplicateProfile(
  db: Db,
  spaceId: string,
  profileId: string
): Promise<string> {
  return db.$transaction(async (tx) => {
    const source = await findProfile(tx, spaceId, profileId);
    await assertRoomForProfile(tx, spaceId);
    const suffix = " (copie)";
    const copy = await tx.mealGenerationProfile.create({
      data: {
        spaceId,
        name: `${source.name.slice(0, PROFILE_NAME_MAX - suffix.length)}${suffix}`,
        description: source.description,
        cooldownDays: source.cooldownDays,
        useIdeas: source.useIdeas,
      },
      select: { id: true },
    });
    const [rules, exclusions, pins] = await Promise.all([
      tx.mealGenerationRule.findMany({ where: { profileId } }),
      tx.mealSlotExclusion.findMany({ where: { profileId } }),
      tx.mealSlotPin.findMany({ where: { profileId } }),
    ]);
    await tx.mealGenerationRule.createMany({
      data: rules.map(({ id: _id, profileId: _profile, ...rule }) => ({
        ...rule,
        profileId: copy.id,
      })),
    });
    await tx.mealSlotExclusion.createMany({
      data: exclusions.map((cell) => ({ ...cell, profileId: copy.id })),
    });
    await tx.mealSlotPin.createMany({ data: pins.map((pin) => ({ ...pin, profileId: copy.id })) });
    return copy.id;
  });
}

/** Le dernier profil reste ; le profil par defaut passe la main a `defaultId` [D183]. */
export async function deleteProfile(
  db: Db,
  spaceId: string,
  profileId: string,
  defaultId: string | undefined
): Promise<void> {
  await db.$transaction(async (tx) => {
    const profile = await findProfile(tx, spaceId, profileId);
    const count = await tx.mealGenerationProfile.count({ where: { spaceId, ...live } });
    if (count <= 1) throw new AppError("MEAL_005");
    if (profile.isDefault) {
      if (!defaultId || defaultId === profileId) throw new AppError("MEAL_006");
      await findProfile(tx, spaceId, defaultId).catch(() => {
        throw new AppError("MEAL_006");
      });
    }
    // Le profil retire cesse d'etre par defaut avant que le suivant le devienne (index partiel).
    await tx.mealGenerationProfile.update({
      where: { id: profileId },
      data: { deletedAt: new Date(), isDefault: false },
    });
    if (profile.isDefault && defaultId) {
      await tx.mealGenerationProfile.update({
        where: { id: defaultId },
        data: { isDefault: true },
      });
    }
  });
}

// --- Regles ---

async function assertTarget(
  ctx: Context,
  spaceId: string,
  viewerId: string,
  target: RuleInput["target"]
): Promise<void> {
  if (target.kind === "TAG") {
    await assertUsableTag(ctx.db, spaceId, target.tagId);
    return;
  }
  const visible = await requiredService(ctx, "recipes.catalog").visible(spaceId, viewerId, [
    target.recipeId,
  ]);
  if (!visible.has(target.recipeId)) throw new AppError("RECIPE_001");
}

function ruleData(body: RuleInput) {
  return {
    tagId: body.target.kind === "TAG" ? body.target.tagId : null,
    recipeId: body.target.kind === "RECIPE" ? body.target.recipeId : null,
    weight: body.weight,
    mealTime: body.mealTime,
    frequencyMin: body.frequencyMin,
    frequencyMax: body.frequencyMax,
    frequencyPer: body.frequencyPer,
    tagCooldownDays: body.tagCooldownDays,
  };
}

export async function addRule(
  ctx: Context,
  spaceId: string,
  viewerId: string,
  profileId: string,
  body: RuleInput
): Promise<string> {
  await findProfile(ctx.db, spaceId, profileId);
  await assertTarget(ctx, spaceId, viewerId, body.target);
  const { _count, _max } = await ctx.db.mealGenerationRule.aggregate({
    where: { profileId },
    _count: true,
    _max: { position: true },
  });
  if (_count >= MAX_RULES) throw new AppError("MEAL_008");
  const rule = await ctx.db.mealGenerationRule.create({
    data: { profileId, position: (_max.position ?? -1) + 1, ...ruleData(body) },
    select: { id: true },
  });
  return rule.id;
}

async function findRule(db: Db, profileId: string, ruleId: string) {
  const rule = await db.mealGenerationRule.findFirst({
    where: { id: ruleId, profileId },
    select: { id: true },
  });
  if (!rule) throw new AppError("MEAL_004");
}

export async function updateRule(
  ctx: Context,
  spaceId: string,
  viewerId: string,
  profileId: string,
  ruleId: string,
  body: RuleInput
): Promise<void> {
  await findProfile(ctx.db, spaceId, profileId);
  await findRule(ctx.db, profileId, ruleId);
  await assertTarget(ctx, spaceId, viewerId, body.target);
  await ctx.db.mealGenerationRule.update({ where: { id: ruleId }, data: ruleData(body) });
}

export async function deleteRule(
  db: Db,
  spaceId: string,
  profileId: string,
  ruleId: string
): Promise<void> {
  await findProfile(db, spaceId, profileId);
  const { count } = await db.mealGenerationRule.deleteMany({ where: { id: ruleId, profileId } });
  if (count === 0) throw new AppError("MEAL_004");
}

/** Rule presentee seule (reponse d'une creation ou d'une modification). */
export async function readRule(
  ctx: Context,
  spaceId: string,
  viewerId: string,
  profileId: string,
  ruleId: string
): Promise<Rule> {
  const profile = await readProfile(ctx, spaceId, viewerId, profileId);
  const rule = profile.rules.find((r) => r.id === ruleId);
  if (!rule) throw new AppError("MEAL_004");
  return rule;
}

// --- Grille jours x repas [D114] ---

export async function putGrid(
  db: Db,
  spaceId: string,
  profileId: string,
  body: PutGridBody
): Promise<void> {
  await db.$transaction(async (tx) => {
    await findProfile(tx, spaceId, profileId);
    const pins = body.cells.flatMap((cell) =>
      cell.state === "PINNED"
        ? [{ profileId, weekday: cell.weekday, mealTime: cell.mealTime, tagId: cell.tagId }]
        : []
    );
    for (const tagId of new Set(pins.map((pin) => pin.tagId))) {
      await assertUsableTag(tx, spaceId, tagId);
    }
    await tx.mealSlotExclusion.deleteMany({ where: { profileId } });
    await tx.mealSlotPin.deleteMany({ where: { profileId } });
    await tx.mealSlotExclusion.createMany({
      data: body.cells.flatMap((cell) =>
        cell.state === "EXCLUDED"
          ? [{ profileId, weekday: cell.weekday, mealTime: cell.mealTime }]
          : []
      ),
    });
    await tx.mealSlotPin.createMany({ data: pins });
  });
}
