// Admin, referentiels (C4.3) : ingredients (verification, traduction, rayon, unite
// par defaut, poids par piece) et fusion [D09, D46, D120], unites, rayons [D125],
// tags globaux. Les noms sont saisis en francais et en anglais [D34]. Chaque
// ecriture est auditee dans la meme transaction. Le seed ne reecrit rien de tout
// ca (update: {}), voir referentials/seed.ts.

import {
  normalizeName,
  type AdminAisle,
  type AdminIngredient,
  type AdminIngredientItem,
  type AdminIngredientTab,
  type AdminTag,
  type AdminUnit,
  type UnitDimension,
} from "@fm/shared";

import type { Context } from "../context.ts";
import { Prisma } from "../db/client.ts";
import { AppError } from "../http/errors.ts";
import { audit } from "./audit.ts";

const FR = "fr";
const EN = "en";
/** Ressemblance (pg_trgm) au-dela de laquelle un nouveau est un doublon probable. */
const DUPLICATE_SIMILARITY = 0.45;
const SIMILAR_LIMIT = 5;
const RECIPE_SAMPLE = 5;

type Tx = Parameters<Parameters<Context["db"]["$transaction"]>[0]>[0];

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** Transaction dont un doublon de nom ou de code devient ADMIN_009. */
async function uniqueOrConflict<T>(ctx: Context, run: (tx: Tx) => Promise<T>): Promise<T> {
  try {
    return await ctx.db.$transaction(run);
  } catch (error) {
    if (isUniqueViolation(error)) throw new AppError("ADMIN_009");
    throw error;
  }
}

/** Code lisible tire d'un nom ("Bio et vrac" -> "bio-et-vrac"). */
function slugify(name: string): string {
  return normalizeName(name)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function uniqueCode(base: string, taken: (code: string) => Promise<boolean>) {
  const root = base || "item";
  for (let n = 1; ; n++) {
    const code = n === 1 ? root : `${root}-${n}`;
    if (!(await taken(code))) return code;
  }
}

// --- Ingredients ---

function tabCondition(tab: AdminIngredientTab | undefined): Prisma.Sql {
  switch (tab) {
    case "NEW":
      return Prisma.sql`i.status = 'NEW'`;
    case "VERIFIED":
      return Prisma.sql`i.status = 'ACTIVE'`;
    case "UNTRANSLATED":
      return Prisma.sql`NOT EXISTS (SELECT 1 FROM "IngredientTranslation" t
        WHERE t."ingredientId" = i.id AND t.locale = ${EN})`;
    case "NO_AISLE":
      return Prisma.sql`i."aisleId" IS NULL`;
    case undefined:
      return Prisma.sql`TRUE`;
  }
}

const RECIPE_COUNT = Prisma.sql`(SELECT count(DISTINCT b."recipeId")::int
  FROM "RecipeIngredient" ri
  JOIN "RecipeBlock" b ON b.id = ri."blockId"
  JOIN "Recipe" r ON r.id = b."recipeId"
  WHERE ri."ingredientId" = i.id AND r."deletedAt" IS NULL)`;

interface ItemRow {
  id: string;
  name: string;
  status: AdminIngredientItem["status"];
  createdAt: Date;
  createdBy: string | null;
  recipeCount: number;
  probableDuplicate: boolean;
}

export async function listIngredients(
  ctx: Context,
  options: { tab?: AdminIngredientTab; query?: string; offset: number; limit: number }
) {
  const like = normalizeName(options.query ?? "").replace(/[\\%_]/g, (c) => `\\${c}`);
  const where = Prisma.sql`i.status <> 'MERGED' AND ${tabCondition(options.tab)}
    AND (${like} = '' OR EXISTS (SELECT 1 FROM "IngredientTranslation" q
      JOIN "Ingredient" qi ON qi.id = q."ingredientId"
      WHERE (qi.id = i.id OR qi."mergedIntoId" = i.id)
        AND q.normalized LIKE '%' || ${like} || '%'))`;
  const order =
    options.tab === "NEW" ? Prisma.sql`i."createdAt" DESC, i.id` : Prisma.sql`fr.normalized`;
  const [rows, [totals], [counts]] = await Promise.all([
    ctx.db.$queryRaw<ItemRow[]>`
      SELECT i.id, fr.name, i.status::text AS status, i."createdAt", u.username AS "createdBy",
        ${RECIPE_COUNT} AS "recipeCount",
        (i.status = 'NEW' AND EXISTS (SELECT 1 FROM "IngredientTranslation" o
          JOIN "Ingredient" oi ON oi.id = o."ingredientId"
          WHERE o.locale = ${FR} AND oi.status = 'ACTIVE' AND o.normalized % fr.normalized
            AND similarity(o.normalized, fr.normalized) >= ${DUPLICATE_SIMILARITY})) AS "probableDuplicate"
      FROM "Ingredient" i
      JOIN "IngredientTranslation" fr ON fr."ingredientId" = i.id AND fr.locale = ${FR}
      LEFT JOIN "User" u ON u.id = i."createdById"
      WHERE ${where}
      ORDER BY ${order}
      OFFSET ${options.offset} LIMIT ${options.limit}`,
    ctx.db.$queryRaw<{ total: number }[]>`
      SELECT count(*)::int AS total FROM "Ingredient" i
      JOIN "IngredientTranslation" fr ON fr."ingredientId" = i.id AND fr.locale = ${FR}
      WHERE ${where}`,
    ctx.db.$queryRaw<Record<AdminIngredientTab, number>[]>`
      SELECT
        count(*) FILTER (WHERE ${tabCondition("NEW")})::int AS "NEW",
        count(*) FILTER (WHERE ${tabCondition("VERIFIED")})::int AS "VERIFIED",
        count(*) FILTER (WHERE ${tabCondition("UNTRANSLATED")})::int AS "UNTRANSLATED",
        count(*) FILTER (WHERE ${tabCondition("NO_AISLE")})::int AS "NO_AISLE"
      FROM "Ingredient" i WHERE i.status <> 'MERGED'`,
  ]);
  return {
    data: rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
    total: totals?.total ?? 0,
    counts: counts ?? { NEW: 0, VERIFIED: 0, UNTRANSLATED: 0, NO_AISLE: 0 },
  };
}

interface SimilarRow {
  id: string;
  name: string;
  status: AdminIngredient["status"];
  aisleId: string | null;
  en: string | null;
  recipeCount: number;
  score: number;
}

function usedInRecipes(ingredientId: string) {
  return {
    deletedAt: null,
    blocks: { some: { ingredients: { some: { ingredientId } } } },
  } satisfies Prisma.RecipeWhereInput;
}

export async function getIngredient(ctx: Context, id: string): Promise<AdminIngredient> {
  const row = await ctx.db.ingredient.findUnique({
    where: { id },
    include: {
      translations: true,
      unitWeights: { orderBy: { grams: "asc" } },
      createdBy: { select: { username: true } },
      mergedInto: { include: { translations: { where: { locale: FR } } } },
      mergedFrom: { include: { translations: { where: { locale: FR } } } },
    },
  });
  if (!row) throw new AppError("ADMIN_008");
  const fr = row.translations.find((t) => t.locale === FR);
  const en = row.translations.find((t) => t.locale === EN);
  const normalized = fr?.normalized ?? "";
  const [recipeCount, recipes, similar] = await Promise.all([
    ctx.db.recipe.count({ where: usedInRecipes(id) }),
    ctx.db.recipe.findMany({
      where: usedInRecipes(id),
      select: { id: true, title: true, author: { select: { username: true } } },
      orderBy: { title: "asc" },
      take: RECIPE_SAMPLE,
    }),
    ctx.db.$queryRaw<SimilarRow[]>`
      SELECT i.id, o.name, i.status::text AS status, i."aisleId", en.name AS en,
        ${RECIPE_COUNT} AS "recipeCount", similarity(o.normalized, ${normalized}) AS score
      FROM "IngredientTranslation" o
      JOIN "Ingredient" i ON i.id = o."ingredientId"
      LEFT JOIN "IngredientTranslation" en ON en."ingredientId" = i.id AND en.locale = ${EN}
      WHERE o.locale = ${FR} AND i.status <> 'MERGED' AND i.id <> ${id}
        AND o.normalized % ${normalized}
      ORDER BY score DESC, o.normalized
      LIMIT ${SIMILAR_LIMIT}`,
  ]);
  const duplicate =
    row.status === "NEW"
      ? similar.find((s) => s.status === "ACTIVE" && s.score >= DUPLICATE_SIMILARITY)
      : undefined;
  return {
    id: row.id,
    status: row.status,
    fr: { name: fr?.name ?? "", namePlural: fr?.namePlural ?? null },
    en: en ? { name: en.name, namePlural: en.namePlural } : null,
    aisleId: row.aisleId,
    defaultUnitId: row.defaultUnitId,
    unitWeights: row.unitWeights.map((w) => ({ unitId: w.unitId, grams: w.grams })),
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdBy?.username ?? null,
    recipeCount,
    recipes: recipes.map((r) => ({ id: r.id, title: r.title, author: r.author.username })),
    synonyms: row.mergedFrom.map((m) => m.translations[0]?.name ?? "").filter(Boolean),
    mergedInto: row.mergedInto
      ? { id: row.mergedInto.id, name: row.mergedInto.translations[0]?.name ?? "" }
      : null,
    similar: similar.map(({ score: _score, ...item }) => item),
    duplicateOfId: duplicate?.id ?? null,
  };
}

interface NameInput {
  name: string;
  namePlural: string | null;
}

function translationData(locale: string, names: NameInput) {
  const name = names.name.replace(/\s+/g, " ");
  return { locale, name, namePlural: names.namePlural, normalized: normalizeName(name) };
}

export async function createIngredient(
  ctx: Context,
  adminId: string,
  body: { fr: NameInput; en: NameInput | null }
): Promise<AdminIngredient> {
  const id = await uniqueOrConflict(ctx, async (tx) => {
    const created = await tx.ingredient.create({
      data: {
        status: "ACTIVE",
        translations: {
          create: [
            translationData(FR, body.fr),
            ...(body.en ? [translationData(EN, body.en)] : []),
          ],
        },
      },
    });
    await audit(tx, {
      adminId,
      action: "ingredient.created",
      targetType: "ingredient",
      targetId: created.id,
      data: { name: body.fr.name },
    });
    return created.id;
  });
  return getIngredient(ctx, id);
}

export interface IngredientUpdate {
  fr: NameInput;
  en: NameInput | null;
  aisleId: string | null;
  defaultUnitId: string | null;
  unitWeights: { unitId: string; grams: number }[];
  verify: boolean;
}

/** Rayon, unite par defaut et unites des poids existent ; poids sur des pieces seulement. */
async function checkReferences(ctx: Context, body: IngredientUpdate) {
  if (body.aisleId && !(await ctx.db.aisle.findUnique({ where: { id: body.aisleId } }))) {
    throw new AppError("ADMIN_011");
  }
  const unitIds = [
    ...new Set([
      ...(body.defaultUnitId ? [body.defaultUnitId] : []),
      ...body.unitWeights.map((w) => w.unitId),
    ]),
  ];
  const units = await ctx.db.unit.findMany({ where: { id: { in: unitIds } } });
  if (units.length !== unitIds.length) throw new AppError("ADMIN_011");
  const counts = new Set(units.filter((u) => u.dimension === "COUNT").map((u) => u.id));
  if (body.unitWeights.some((w) => !counts.has(w.unitId))) throw new AppError("ADMIN_011");
}

export async function updateIngredient(
  ctx: Context,
  adminId: string,
  id: string,
  body: IngredientUpdate
): Promise<AdminIngredient> {
  const current = await ctx.db.ingredient.findUnique({ where: { id } });
  if (!current || current.status === "MERGED") throw new AppError("ADMIN_008");
  await checkReferences(ctx, body);
  await uniqueOrConflict(ctx, async (tx) => {
    await tx.ingredient.update({
      where: { id },
      data: {
        aisleId: body.aisleId,
        defaultUnitId: body.defaultUnitId,
        ...(body.verify ? { status: "ACTIVE" as const } : {}),
      },
    });
    const fr = translationData(FR, body.fr);
    await tx.ingredientTranslation.upsert({
      where: { ingredientId_locale: { ingredientId: id, locale: FR } },
      create: { ingredientId: id, ...fr },
      update: fr,
    });
    if (body.en) {
      const en = translationData(EN, body.en);
      await tx.ingredientTranslation.upsert({
        where: { ingredientId_locale: { ingredientId: id, locale: EN } },
        create: { ingredientId: id, ...en },
        update: en,
      });
    } else {
      await tx.ingredientTranslation.deleteMany({ where: { ingredientId: id, locale: EN } });
    }
    await tx.ingredientUnitWeight.deleteMany({ where: { ingredientId: id } });
    await tx.ingredientUnitWeight.createMany({
      data: body.unitWeights.map((w) => ({ ingredientId: id, unitId: w.unitId, grams: w.grams })),
    });
    await audit(tx, {
      adminId,
      action: body.verify ? "ingredient.verified" : "ingredient.updated",
      targetType: "ingredient",
      targetId: id,
      data: { name: fr.name },
    });
  });
  return getIngredient(ctx, id);
}

/**
 * Fusion [D120] : les lignes des recettes pointent vers la cible, quantites
 * inchangees ; les revisions passees restent telles quelles. Le fusionne devient
 * un synonyme (la saisie le remplace par la cible), comme ceux qu'il portait deja.
 * Personne n'est notifie.
 */
export async function mergeIngredient(
  ctx: Context,
  adminId: string,
  id: string,
  intoId: string
): Promise<AdminIngredient> {
  await ctx.db.$transaction(async (tx) => {
    const [source, target] = await Promise.all([
      tx.ingredient.findUnique({ where: { id } }),
      tx.ingredient.findUnique({ where: { id: intoId } }),
    ]);
    if (!source || !target) throw new AppError("ADMIN_008");
    if (source.id === target.id || source.status === "MERGED" || target.status === "MERGED") {
      throw new AppError("ADMIN_010");
    }
    const recipeCount = await tx.recipe.count({ where: usedInRecipes(id) });
    await tx.recipeIngredient.updateMany({
      where: { ingredientId: id },
      data: { ingredientId: intoId },
    });
    await tx.ingredient.updateMany({ where: { mergedIntoId: id }, data: { mergedIntoId: intoId } });
    await tx.ingredient.update({ where: { id }, data: { status: "MERGED", mergedIntoId: intoId } });
    await audit(tx, {
      adminId,
      action: "ingredient.merged",
      targetType: "ingredient",
      targetId: id,
      data: { intoId, recipeCount },
    });
  });
  return getIngredient(ctx, intoId);
}

// --- Unites ---

const unitInclude = {
  translations: { where: { locale: { in: [FR, EN] } } },
} satisfies Prisma.UnitInclude;

type UnitRow = Prisma.UnitGetPayload<{ include: typeof unitInclude }>;

function toAdminUnit(row: UnitRow): AdminUnit {
  const names = (locale: string) => {
    const t = row.translations.find((tr) => tr.locale === locale);
    return t ? { name: t.name, namePlural: t.namePlural, abbreviation: t.abbreviation } : null;
  };
  return {
    id: row.id,
    code: row.code,
    dimension: row.dimension,
    toBase: row.toBase,
    metric: row.metric,
    fr: names(FR) ?? { name: row.code, namePlural: null, abbreviation: row.code },
    en: names(EN),
  };
}

export async function listUnits(ctx: Context): Promise<AdminUnit[]> {
  const rows = await ctx.db.unit.findMany({ include: unitInclude, orderBy: { sortOrder: "asc" } });
  return rows.map(toAdminUnit);
}

interface UnitNames {
  name: string;
  namePlural: string | null;
  abbreviation: string;
}
export interface UnitInput {
  dimension: UnitDimension;
  toBase: number | null;
  metric: boolean;
  fr: UnitNames;
  en: UnitNames | null;
}

async function writeUnitTranslations(tx: Tx, unitId: string, body: UnitInput) {
  await tx.unitTranslation.upsert({
    where: { unitId_locale: { unitId, locale: FR } },
    create: { unitId, locale: FR, ...body.fr },
    update: body.fr,
  });
  if (body.en) {
    await tx.unitTranslation.upsert({
      where: { unitId_locale: { unitId, locale: EN } },
      create: { unitId, locale: EN, ...body.en },
      update: body.en,
    });
  } else {
    await tx.unitTranslation.deleteMany({ where: { unitId, locale: EN } });
  }
}

export async function createUnit(
  ctx: Context,
  adminId: string,
  body: UnitInput & { code: string }
): Promise<AdminUnit> {
  const row = await uniqueOrConflict(ctx, async (tx) => {
    const last = await tx.unit.aggregate({ _max: { sortOrder: true } });
    const unit = await tx.unit.create({
      data: {
        code: body.code,
        dimension: body.dimension,
        toBase: body.toBase,
        metric: body.metric,
        sortOrder: (last._max.sortOrder ?? -1) + 1,
      },
    });
    await writeUnitTranslations(tx, unit.id, body);
    await audit(tx, {
      adminId,
      action: "unit.created",
      targetType: "unit",
      targetId: unit.id,
      data: { code: body.code },
    });
    return tx.unit.findUniqueOrThrow({ where: { id: unit.id }, include: unitInclude });
  });
  return toAdminUnit(row);
}

export async function updateUnit(
  ctx: Context,
  adminId: string,
  id: string,
  body: UnitInput
): Promise<AdminUnit> {
  const row = await ctx.db.$transaction(async (tx) => {
    const unit = await tx.unit.findUnique({ where: { id } });
    if (!unit) throw new AppError("ADMIN_008");
    await tx.unit.update({
      where: { id },
      data: { dimension: body.dimension, toBase: body.toBase, metric: body.metric },
    });
    await writeUnitTranslations(tx, id, body);
    await audit(tx, {
      adminId,
      action: "unit.updated",
      targetType: "unit",
      targetId: id,
      data: { code: unit.code },
    });
    return tx.unit.findUniqueOrThrow({ where: { id }, include: unitInclude });
  });
  return toAdminUnit(row);
}

// --- Rayons ---

export async function listAisles(
  ctx: Context
): Promise<{ data: AdminAisle[]; unclassifiedCount: number }> {
  const [rows, unclassifiedCount] = await Promise.all([
    ctx.db.aisle.findMany({
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
      include: {
        translations: { where: { locale: { in: [FR, EN] } } },
        _count: { select: { ingredients: { where: { status: { not: "MERGED" } } } } },
      },
    }),
    ctx.db.ingredient.count({ where: { aisleId: null, status: { not: "MERGED" } } }),
  ]);
  return {
    data: rows.map((row) => ({
      id: row.id,
      code: row.code,
      fr: row.translations.find((t) => t.locale === FR)?.name ?? row.code,
      en: row.translations.find((t) => t.locale === EN)?.name ?? null,
      ingredientCount: row._count.ingredients,
    })),
    unclassifiedCount,
  };
}

async function aisleById(ctx: Context, id: string): Promise<AdminAisle> {
  const found = (await listAisles(ctx)).data.find((a) => a.id === id);
  if (!found) throw new AppError("ADMIN_008");
  return found;
}

async function writeAisleTranslations(tx: Tx, aisleId: string, fr: string, en: string | null) {
  await tx.aisleTranslation.upsert({
    where: { aisleId_locale: { aisleId, locale: FR } },
    create: { aisleId, locale: FR, name: fr },
    update: { name: fr },
  });
  if (en) {
    await tx.aisleTranslation.upsert({
      where: { aisleId_locale: { aisleId, locale: EN } },
      create: { aisleId, locale: EN, name: en },
      update: { name: en },
    });
  } else {
    await tx.aisleTranslation.deleteMany({ where: { aisleId, locale: EN } });
  }
}

export async function createAisle(
  ctx: Context,
  adminId: string,
  body: { fr: string; en: string | null }
): Promise<AdminAisle> {
  const id = await ctx.db.$transaction(async (tx) => {
    const code = await uniqueCode(
      slugify(body.fr),
      async (c) => (await tx.aisle.findUnique({ where: { code: c } })) !== null
    );
    const last = await tx.aisle.aggregate({ _max: { sortOrder: true } });
    const aisle = await tx.aisle.create({
      data: { code, sortOrder: (last._max.sortOrder ?? -1) + 1 },
    });
    await writeAisleTranslations(tx, aisle.id, body.fr, body.en);
    await audit(tx, {
      adminId,
      action: "aisle.created",
      targetType: "aisle",
      targetId: aisle.id,
      data: { name: body.fr },
    });
    return aisle.id;
  });
  return aisleById(ctx, id);
}

export async function updateAisle(
  ctx: Context,
  adminId: string,
  id: string,
  body: { fr: string; en: string | null }
): Promise<AdminAisle> {
  await ctx.db.$transaction(async (tx) => {
    if (!(await tx.aisle.findUnique({ where: { id } }))) throw new AppError("ADMIN_008");
    await writeAisleTranslations(tx, id, body.fr, body.en);
    await audit(tx, {
      adminId,
      action: "aisle.updated",
      targetType: "aisle",
      targetId: id,
      data: { name: body.fr },
    });
  });
  return aisleById(ctx, id);
}

/** Ordre du parcours en magasin : la liste complete des rayons, chacun une fois. */
export async function reorderAisles(ctx: Context, adminId: string, ids: string[]) {
  await ctx.db.$transaction(async (tx) => {
    const all = await tx.aisle.findMany({ select: { id: true } });
    const known = new Set(all.map((a) => a.id));
    const unique = new Set(ids);
    if (unique.size !== ids.length || ids.length !== known.size || ids.some((i) => !known.has(i))) {
      throw new AppError("ADMIN_012");
    }
    for (const [index, aisleId] of ids.entries()) {
      await tx.aisle.update({ where: { id: aisleId }, data: { sortOrder: index } });
    }
    await audit(tx, { adminId, action: "aisle.reordered", data: { ids } });
  });
  return listAisles(ctx);
}

// --- Tags globaux ---

const liveGlobal = { scope: "GLOBAL", deletedAt: null, mergedIntoId: null } as const;

export async function listTags(ctx: Context): Promise<AdminTag[]> {
  const rows = await ctx.db.tag.findMany({
    where: liveGlobal,
    include: {
      translations: { where: { locale: { in: [FR, EN] } } },
      _count: { select: { recipes: { where: { recipe: { deletedAt: null } } } } },
    },
  });
  return rows
    .map((row) => ({
      id: row.id,
      fr: row.translations.find((t) => t.locale === FR)?.name ?? row.name,
      en: row.translations.find((t) => t.locale === EN)?.name ?? null,
      recipeCount: row._count.recipes,
    }))
    .sort((a, b) => a.fr.localeCompare(b.fr, "fr"));
}

async function tagById(ctx: Context, id: string): Promise<AdminTag> {
  const found = (await listTags(ctx)).find((t) => t.id === id);
  if (!found) throw new AppError("ADMIN_008");
  return found;
}

async function liveTag(tx: Tx, id: string) {
  const tag = await tx.tag.findFirst({ where: { id, ...liveGlobal } });
  if (!tag) throw new AppError("ADMIN_008");
  return tag;
}

/** Un autre tag global vivant porte deja ce nom (sans casse ni accents). */
async function assertTagNameFree(tx: Tx, name: string, exceptId?: string) {
  const others = await tx.tag.findMany({
    where: { ...liveGlobal, ...(exceptId ? { id: { not: exceptId } } : {}) },
    include: { translations: { where: { locale: FR } } },
  });
  const wanted = normalizeName(name);
  const taken = others.some(
    (t) =>
      normalizeName(t.name) === wanted || normalizeName(t.translations[0]?.name ?? "") === wanted
  );
  if (taken) throw new AppError("ADMIN_009");
}

async function writeTagTranslations(tx: Tx, tagId: string, fr: string, en: string | null) {
  await tx.tagTranslation.upsert({
    where: { tagId_locale: { tagId, locale: FR } },
    create: { tagId, locale: FR, name: fr },
    update: { name: fr },
  });
  if (en) {
    await tx.tagTranslation.upsert({
      where: { tagId_locale: { tagId, locale: EN } },
      create: { tagId, locale: EN, name: en },
      update: { name: en },
    });
  } else {
    await tx.tagTranslation.deleteMany({ where: { tagId, locale: EN } });
  }
}

export async function createTag(
  ctx: Context,
  adminId: string,
  body: { fr: string; en: string | null }
): Promise<AdminTag> {
  const id = await ctx.db.$transaction(async (tx) => {
    await assertTagNameFree(tx, body.fr);
    // Le slug reste unique meme parmi les tags supprimes (index partiel global).
    const slug = await uniqueCode(
      slugify(body.fr),
      async (s) => (await tx.tag.findFirst({ where: { scope: "GLOBAL", slug: s } })) !== null
    );
    const tag = await tx.tag.create({ data: { scope: "GLOBAL", name: body.fr, slug } });
    await writeTagTranslations(tx, tag.id, body.fr, body.en);
    await audit(tx, {
      adminId,
      action: "tag.created",
      targetType: "tag",
      targetId: tag.id,
      data: { name: body.fr },
    });
    return tag.id;
  });
  return tagById(ctx, id);
}

/** Renommer garde le slug : le seed retrouve le tag et ne le recree pas. */
export async function updateTag(
  ctx: Context,
  adminId: string,
  id: string,
  body: { fr: string; en: string | null }
): Promise<AdminTag> {
  await ctx.db.$transaction(async (tx) => {
    await liveTag(tx, id);
    await assertTagNameFree(tx, body.fr, id);
    await tx.tag.update({ where: { id }, data: { name: body.fr } });
    await writeTagTranslations(tx, id, body.fr, body.en);
    await audit(tx, {
      adminId,
      action: "tag.updated",
      targetType: "tag",
      targetId: id,
      data: { name: body.fr },
    });
  });
  return tagById(ctx, id);
}

/** Fusion : les recettes du tag passent a la cible, le tag disparait des listes. */
export async function mergeTag(
  ctx: Context,
  adminId: string,
  id: string,
  intoId: string
): Promise<AdminTag> {
  await ctx.db.$transaction(async (tx) => {
    if (id === intoId) throw new AppError("ADMIN_010");
    await liveTag(tx, id);
    const target = await tx.tag.findFirst({ where: { id: intoId, ...liveGlobal } });
    if (!target) throw new AppError("ADMIN_010");
    const links = await tx.recipeGlobalTag.findMany({ where: { tagId: id } });
    await tx.recipeGlobalTag.createMany({
      data: links.map((link) => ({ recipeId: link.recipeId, tagId: intoId })),
      skipDuplicates: true,
    });
    await tx.recipeGlobalTag.deleteMany({ where: { tagId: id } });
    await tx.tag.update({ where: { id }, data: { mergedIntoId: intoId, deletedAt: new Date() } });
    await audit(tx, {
      adminId,
      action: "tag.merged",
      targetType: "tag",
      targetId: id,
      data: { intoId, recipeCount: links.length },
    });
  });
  return tagById(ctx, intoId);
}

/** Suppression : retire le tag de toutes les recettes. */
export async function deleteTag(ctx: Context, adminId: string, id: string): Promise<void> {
  await ctx.db.$transaction(async (tx) => {
    const tag = await liveTag(tx, id);
    const { count } = await tx.recipeGlobalTag.deleteMany({ where: { tagId: id } });
    await tx.tag.update({ where: { id }, data: { deletedAt: new Date() } });
    await audit(tx, {
      adminId,
      action: "tag.deleted",
      targetType: "tag",
      targetId: id,
      data: { name: tag.name, recipeCount: count },
    });
  });
}
