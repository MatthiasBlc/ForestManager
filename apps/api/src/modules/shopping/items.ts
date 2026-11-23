// Articles de la liste [D228, D231] : lecture, ajout fusionne par produit et par
// section, coches, section favorite, ordre, retirer les achetes et Annuler.
import {
  addParts,
  MAX_SHOPPING_ITEMS,
  mergeIntoList,
  productKey,
  resolveSectionId,
  type CreateShoppingItemBody,
  type MealTime,
  type PlanSource,
  type RestoreShoppingItemsBody,
  type ShoppingItem,
  type ShoppingPart,
  type ShoppingUnit,
  type UpdateShoppingItemBody,
} from "@fm/shared";

import type { Context } from "../../core/context.ts";
import type { Prisma } from "../../core/db/client.ts";
import { AppError } from "../../core/http/errors.ts";
import { toUserSummary } from "../../core/storage/images.ts";

const LOCALE = "fr"; // francais seul en V2 [D34]

export const itemInclude = {
  ingredient: {
    select: {
      id: true,
      translations: { where: { locale: LOCALE }, select: { name: true, namePlural: true } },
    },
  },
  parts: { orderBy: { position: "asc" }, select: { quantity: true, unitId: true } },
  sources: {
    orderBy: [{ date: "asc" }, { mealTime: "asc" }, { id: "asc" }],
    select: {
      mealSlotId: true,
      recipeId: true,
      recipeTitle: true,
      date: true,
      mealTime: true,
      parts: true,
    },
  },
  checkedBy: { select: { id: true, username: true, avatarKey: true } },
} as const satisfies Prisma.ShoppingItemInclude;

export type ItemRow = Prisma.ShoppingItemGetPayload<{ include: typeof itemInclude }>;

/** Parts gardees en JSON dans une source : `[{ quantity, unitId }]`. */
export function partsOf(json: Prisma.JsonValue): { quantity: number; unitId: string | null }[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((part) => {
    if (part === null || typeof part !== "object" || Array.isArray(part)) return [];
    const { quantity, unitId } = part;
    if (typeof quantity !== "number") return [];
    return [{ quantity, unitId: typeof unitId === "string" ? unitId : null }];
  });
}

export function toItem(ctx: Context, row: ItemRow): ShoppingItem {
  const name = row.ingredient?.translations[0];
  return {
    id: row.id,
    sectionId: row.sectionId,
    ingredient: row.ingredient
      ? { id: row.ingredient.id, name: name?.name ?? "", namePlural: name?.namePlural ?? null }
      : null,
    label: row.label,
    parts: row.parts,
    sortOrder: row.sortOrder,
    checkedAt: row.checkedAt?.toISOString() ?? null,
    checkedBy: row.checkedBy ? toUserSummary(ctx, row.checkedBy) : null,
    sources: row.sources.map((source) => ({
      mealSlotId: source.mealSlotId,
      recipeId: source.recipeId,
      recipeTitle: source.recipeTitle,
      date: source.date.toISOString().slice(0, 10),
      mealTime: source.mealTime satisfies MealTime,
      parts: partsOf(source.parts),
    })),
  };
}

export async function listItems(ctx: Context, spaceId: string): Promise<ShoppingItem[]> {
  const rows = await ctx.db.shoppingItem.findMany({
    where: { spaceId },
    include: itemInclude,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });
  return rows.map((row) => toItem(ctx, row));
}

// --- Ecriture [D228, D231] ---

type Tx = Prisma.TransactionClient;

/** Unites du referentiel, pour additionner les parts. */
export async function loadUnits(db: Tx | Context["db"]): Promise<ShoppingUnit[]> {
  return db.unit.findMany({
    select: { id: true, code: true, dimension: true, toBase: true, metric: true },
  });
}

/** Poids d'une piece, par ingredient puis par id d'unite [D46]. */
export async function loadWeights(
  db: Tx | Context["db"],
  ingredientIds: readonly string[]
): Promise<Record<string, Record<string, number>>> {
  if (ingredientIds.length === 0) return {};
  const rows = await db.ingredientUnitWeight.findMany({
    where: { ingredientId: { in: [...new Set(ingredientIds)] } },
  });
  const weights: Record<string, Record<string, number>> = {};
  for (const row of rows) {
    weights[row.ingredientId] = { ...weights[row.ingredientId], [row.unitId]: row.grams };
  }
  return weights;
}

/** Sections favorites de l'espace, par cle de produit. */
async function loadFavorites(db: Tx, spaceId: string): Promise<Map<string, string>> {
  const rows = await db.shoppingPlacement.findMany({ where: { spaceId } });
  return new Map(rows.map((row) => [row.productKey, row.sectionId]));
}

export interface SourceInput extends PlanSource {
  parts: ShoppingPart[];
}

export interface ItemInput {
  ingredientId: string | null;
  label: string | null;
  parts: ShoppingPart[];
  sources: SourceInput[];
}

/** Ingredient (fusionne : sa cible [D120]) et son rayon ; leve SHOPPING_008 s'il manque. */
async function resolveIngredients(
  tx: Tx,
  ids: readonly string[]
): Promise<Map<string, { id: string; aisleId: string | null }>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const rows = await tx.ingredient.findMany({
    where: { id: { in: unique } },
    select: {
      id: true,
      aisleId: true,
      mergedInto: { select: { id: true, aisleId: true } },
    },
  });
  if (rows.length !== unique.length) throw new AppError("SHOPPING_008");
  return new Map(
    rows.map((row) => [row.id, row.mergedInto ?? { id: row.id, aisleId: row.aisleId }])
  );
}

async function assertUnits(tx: Tx, inputs: readonly ItemInput[]): Promise<void> {
  const ids = new Set(
    inputs.flatMap((input) => input.parts.flatMap((part) => (part.unitId ? [part.unitId] : [])))
  );
  if (ids.size === 0) return;
  const count = await tx.unit.count({ where: { id: { in: [...ids] } } });
  if (count !== ids.size) throw new AppError("SHOPPING_008");
}

function sourceRows(sources: readonly SourceInput[]) {
  return sources.map((source) => ({
    mealSlotId: source.mealSlotId,
    recipeId: source.recipeId,
    recipeTitle: source.recipeTitle,
    date: new Date(`${source.date}T00:00:00.000Z`),
    mealTime: source.mealTime,
    parts: source.parts.flatMap((part) =>
      part.quantity === null ? [] : [{ quantity: part.quantity, unitId: part.unitId }]
    ),
  }));
}

function partRows(parts: readonly ShoppingPart[]) {
  return parts.flatMap((part, position) =>
    part.quantity === null ? [] : [{ position, quantity: part.quantity, unitId: part.unitId }]
  );
}

/**
 * Ajoute des articles, fusionnes par produit et par section [D231] : section
 * favorite, sinon celle du rayon, sinon "Autres" ; ligne non cochee du meme produit
 * dans cette section completee, sinon nouvelle ligne en fin de section.
 */
export async function addItems(
  tx: Tx,
  spaceId: string,
  userId: string,
  inputs: readonly ItemInput[]
): Promise<{ created: string[]; updated: string[] }> {
  await assertUnits(tx, inputs);
  const ingredients = await resolveIngredients(
    tx,
    inputs.flatMap((input) => (input.ingredientId ? [input.ingredientId] : []))
  );
  const [units, favorites, sections, existing] = await Promise.all([
    loadUnits(tx),
    loadFavorites(tx, spaceId),
    tx.shoppingSection.findMany({ where: { spaceId }, select: { id: true, aisleId: true } }),
    tx.shoppingItem.findMany({
      where: { spaceId },
      select: {
        id: true,
        productKey: true,
        sectionId: true,
        checkedAt: true,
        sortOrder: true,
        ingredientId: true,
        parts: { orderBy: { position: "asc" }, select: { quantity: true, unitId: true } },
      },
    }),
  ]);

  const additions = inputs.map((input) => {
    const ingredient = input.ingredientId ? ingredients.get(input.ingredientId) : undefined;
    const ref = { ingredientId: ingredient?.id ?? null, label: ingredient ? null : input.label };
    const key = productKey(ref);
    const sectionId = resolveSectionId(
      { key, aisleId: ingredient?.aisleId ?? null },
      favorites,
      sections
    );
    return { key, sectionId, parts: input.parts, payload: { input, ref } };
  });
  const ingredientOf = new Map(
    additions.flatMap((a) =>
      a.payload.ref.ingredientId ? [[a.key, a.payload.ref.ingredientId]] : []
    )
  );
  const weights = await loadWeights(tx, [...ingredientOf.values()]);
  const add = (key: string, parts: ShoppingPart[]) =>
    addParts(parts, units, weights[ingredientOf.get(key) ?? ""] ?? {});

  const merge = mergeIntoList(
    existing.map((item) => ({
      id: item.id,
      key: item.productKey,
      sectionId: item.sectionId,
      checked: item.checkedAt !== null,
      parts: item.parts,
    })),
    additions,
    add
  );
  if (existing.length + merge.creates.length > MAX_SHOPPING_ITEMS) {
    throw new AppError("SHOPPING_007");
  }

  for (const update of merge.updates) {
    await tx.shoppingItemPart.deleteMany({ where: { itemId: update.id } });
    await tx.shoppingItem.update({
      where: { id: update.id },
      data: {
        parts: { createMany: { data: partRows(update.parts) } },
        sources: {
          createMany: { data: sourceRows(update.payloads.flatMap((p) => p.input.sources)) },
        },
      },
    });
  }

  const lastOrder = new Map<string, number>();
  for (const item of existing) {
    const at = item.sectionId ?? "";
    lastOrder.set(at, Math.max(lastOrder.get(at) ?? -1, item.sortOrder));
  }
  const created: string[] = [];
  for (const create of merge.creates) {
    const at = create.sectionId ?? "";
    const sortOrder = (lastOrder.get(at) ?? -1) + 1;
    lastOrder.set(at, sortOrder);
    const ref = create.payloads[0]?.ref ?? { ingredientId: null, label: null };
    const row = await tx.shoppingItem.create({
      data: {
        spaceId,
        sectionId: create.sectionId,
        ingredientId: ref.ingredientId,
        label: ref.label,
        productKey: create.key,
        sortOrder,
        createdById: userId,
        parts: { createMany: { data: partRows(create.parts) } },
        sources: {
          createMany: { data: sourceRows(create.payloads.flatMap((p) => p.input.sources)) },
        },
      },
      select: { id: true },
    });
    created.push(row.id);
  }
  return { created, updated: merge.updates.map((update) => update.id) };
}

export async function readItem(
  ctx: Context,
  spaceId: string,
  itemId: string
): Promise<ShoppingItem> {
  const row = await ctx.db.shoppingItem.findFirst({
    where: { id: itemId, spaceId },
    include: itemInclude,
  });
  if (!row) throw new AppError("SHOPPING_001");
  return toItem(ctx, row);
}

/** Article a la main (POST /items) : renvoie l'article et s'il est nouveau. */
export async function createItem(
  ctx: Context,
  spaceId: string,
  userId: string,
  body: CreateShoppingItemBody
): Promise<{ item: ShoppingItem; created: boolean }> {
  const result = await ctx.db.$transaction((tx) =>
    addItems(tx, spaceId, userId, [
      {
        ingredientId: body.ingredientId ?? null,
        label: body.label ?? null,
        parts: body.parts,
        sources: [],
      },
    ])
  );
  const id = result.created[0] ?? result.updated[0] ?? "";
  return { item: await readItem(ctx, spaceId, id), created: result.created.length > 0 };
}

async function lastSortOrder(tx: Tx, spaceId: string, sectionId: string | null): Promise<number> {
  const last = await tx.shoppingItem.aggregate({
    where: { spaceId, sectionId },
    _max: { sortOrder: true },
  });
  return last._max.sortOrder ?? -1;
}

/**
 * Modifier un article : parts, coche (la plus recente gagne), section. Le premier
 * deplacement d'un produit sans favorite la fixe ; "Toujours ranger ici"
 * (`rememberSection`) la change ; "Autres" n'est jamais une favorite [D231].
 */
export async function updateItem(
  ctx: Context,
  spaceId: string,
  userId: string,
  itemId: string,
  body: UpdateShoppingItemBody
): Promise<ShoppingItem> {
  await ctx.db.$transaction(async (tx) => {
    const item = await tx.shoppingItem.findFirst({ where: { id: itemId, spaceId } });
    if (!item) throw new AppError("SHOPPING_001");
    const data: Prisma.ShoppingItemUncheckedUpdateInput = {};

    if (body.parts !== undefined) {
      await assertUnits(tx, [{ ingredientId: null, label: null, parts: body.parts, sources: [] }]);
      await tx.shoppingItemPart.deleteMany({ where: { itemId } });
      data.parts = { createMany: { data: partRows(body.parts) } };
    }

    if (body.checked !== undefined) {
      const at = body.checkedChangedAt ? new Date(body.checkedChangedAt) : new Date();
      const stale = item.checkChangedAt !== null && at < item.checkChangedAt;
      if (!stale) {
        data.checkedAt = body.checked ? (item.checkedAt ?? new Date()) : null;
        data.checkedById = body.checked ? (item.checkedAt ? item.checkedById : userId) : null;
        data.checkChangedAt = at;
      }
    }

    const target = body.sectionId === undefined ? item.sectionId : body.sectionId;
    if (target !== null && target !== item.sectionId) {
      const section = await tx.shoppingSection.findFirst({
        where: { id: target, spaceId },
        select: { id: true },
      });
      if (!section) throw new AppError("SHOPPING_002");
    }
    if (target !== item.sectionId) {
      data.sectionId = target;
      data.sortOrder = (await lastSortOrder(tx, spaceId, target)) + 1;
    }

    const where = { spaceId_productKey: { spaceId, productKey: item.productKey } };
    if (body.rememberSection === true) {
      if (target === null)
        await tx.shoppingPlacement.deleteMany({ where: where.spaceId_productKey });
      else
        await tx.shoppingPlacement.upsert({
          where,
          create: { spaceId, productKey: item.productKey, sectionId: target },
          update: { sectionId: target },
        });
    } else if (target !== null && target !== item.sectionId) {
      // Premier deplacement : seulement si le produit n'a pas encore de favorite.
      await tx.shoppingPlacement.createMany({
        data: [{ spaceId, productKey: item.productKey, sectionId: target }],
        skipDuplicates: true,
      });
    }

    await tx.shoppingItem.update({ where: { id: itemId }, data });
  });
  return readItem(ctx, spaceId, itemId);
}

export async function deleteItem(ctx: Context, spaceId: string, itemId: string): Promise<void> {
  const removed = await ctx.db.shoppingItem.deleteMany({ where: { id: itemId, spaceId } });
  if (removed.count === 0) throw new AppError("SHOPPING_001");
}

/** Ordre complet des articles d'une section (null : "Autres"). */
export async function reorderItems(
  ctx: Context,
  spaceId: string,
  sectionId: string | null,
  ids: readonly string[]
): Promise<void> {
  if (sectionId !== null) {
    const section = await ctx.db.shoppingSection.findFirst({
      where: { id: sectionId, spaceId },
      select: { id: true },
    });
    if (!section) throw new AppError("SHOPPING_002");
  }
  const current = await ctx.db.shoppingItem.findMany({
    where: { spaceId, sectionId },
    select: { id: true },
  });
  const known = new Set(current.map((item) => item.id));
  if (ids.length !== known.size || ids.some((id) => !known.has(id))) {
    throw new AppError("SHOPPING_005");
  }
  await ctx.db.$transaction(
    ids.map((id, sortOrder) => ctx.db.shoppingItem.update({ where: { id }, data: { sortOrder } }))
  );
}

/** "Retirer les achetes" : supprime les articles coches et les renvoie (Annuler). */
export async function clearChecked(ctx: Context, spaceId: string): Promise<ShoppingItem[]> {
  return ctx.db.$transaction(async (tx) => {
    const rows = await tx.shoppingItem.findMany({
      where: { spaceId, checkedAt: { not: null } },
      include: itemInclude,
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
    await tx.shoppingItem.deleteMany({ where: { id: { in: rows.map((row) => row.id) } } });
    return rows.map((row) => toItem(ctx, row));
  });
}

/**
 * Annuler du toast : recree les articles retires, avec leur id. Un article deja
 * present est ignore ; section, repas ou recette disparus entre-temps : null ;
 * ingredient disparu : article ignore.
 */
export async function restoreItems(
  ctx: Context,
  spaceId: string,
  userId: string,
  body: RestoreShoppingItemsBody
): Promise<ShoppingItem[]> {
  const ids = body.items.map((item) => item.id);
  await ctx.db.$transaction(async (tx) => {
    const [present, sections, ingredients, units] = await Promise.all([
      tx.shoppingItem.findMany({ where: { id: { in: ids } }, select: { id: true } }),
      tx.shoppingSection.findMany({ where: { spaceId }, select: { id: true } }),
      tx.ingredient.findMany({
        where: { id: { in: body.items.flatMap((i) => (i.ingredientId ? [i.ingredientId] : [])) } },
        select: { id: true },
      }),
      tx.unit.findMany({ select: { id: true } }),
    ]);
    const skip = new Set(present.map((row) => row.id));
    const sectionIds = new Set(sections.map((row) => row.id));
    const ingredientIds = new Set(ingredients.map((row) => row.id));
    const unitIds = new Set(units.map((row) => row.id));
    const sources = body.items.flatMap((item) => item.sources);
    const [meals, recipes] = await Promise.all([
      tx.mealSlot.findMany({
        where: {
          spaceId,
          id: { in: sources.flatMap((s) => (s.mealSlotId ? [s.mealSlotId] : [])) },
        },
        select: { id: true },
      }),
      tx.recipe.findMany({
        where: { id: { in: sources.flatMap((s) => (s.recipeId ? [s.recipeId] : [])) } },
        select: { id: true },
      }),
    ]);
    const mealIds = new Set(meals.map((row) => row.id));
    const recipeIds = new Set(recipes.map((row) => row.id));
    const count = await tx.shoppingItem.count({ where: { spaceId } });
    const toRestore = body.items.filter(
      (item) =>
        !skip.has(item.id) &&
        (item.ingredientId === null ? item.label !== null : ingredientIds.has(item.ingredientId))
    );
    if (count + toRestore.length > MAX_SHOPPING_ITEMS) throw new AppError("SHOPPING_007");
    const keepUnit = (part: { quantity: number; unitId: string | null }) =>
      part.unitId === null || unitIds.has(part.unitId);
    for (const item of toRestore) {
      const ref = { ingredientId: item.ingredientId, label: item.ingredientId ? null : item.label };
      await tx.shoppingItem.create({
        data: {
          id: item.id,
          spaceId,
          sectionId: item.sectionId && sectionIds.has(item.sectionId) ? item.sectionId : null,
          ingredientId: ref.ingredientId,
          label: ref.label,
          productKey: productKey(ref),
          sortOrder: item.sortOrder,
          checkedAt: item.checkedAt ? new Date(item.checkedAt) : null,
          checkedById: item.checkedAt ? userId : null,
          createdById: userId,
          parts: { createMany: { data: partRows(item.parts.filter(keepUnit)) } },
          sources: {
            createMany: {
              data: sourceRows(
                item.sources.map((source) => ({
                  ...source,
                  mealSlotId:
                    source.mealSlotId && mealIds.has(source.mealSlotId) ? source.mealSlotId : null,
                  recipeId:
                    source.recipeId && recipeIds.has(source.recipeId) ? source.recipeId : null,
                  parts: source.parts.filter(keepUnit),
                }))
              ),
            },
          },
        },
      });
    }
  });
  const rows = await ctx.db.shoppingItem.findMany({
    where: { spaceId, id: { in: ids } },
    include: itemInclude,
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
  return rows.map((row) => toItem(ctx, row));
}
