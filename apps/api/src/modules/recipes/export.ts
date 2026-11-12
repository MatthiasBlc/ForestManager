// Export des recettes (P12) [D37, D192] : `recettes.json` (format versionne,
// relu par `recipesExportSchema`) ou un fichier Markdown par recette, photos
// dans `photos/` si demande. Les sous-recettes liees sont jointes a l'archive
// et referencees par leur `ref`.
import {
  formatQuantity,
  normalizeName,
  RECIPES_EXPORT_FORMAT,
  RECIPES_EXPORT_VERSION,
  type ExportedBlock,
  type ExportedRecipe,
  type RecipesExport,
} from "@fm/shared";
import { strToU8 } from "fflate";

import type { Context } from "../../core/context.ts";
import { Prisma } from "../../core/db/client.ts";
import type { ArchiveFile, ExportRequest } from "../../core/exports/types.ts";
import { authoredBySql, visibleInSql } from "./list.ts";

const LOCALE = "fr"; // francais seul en V2.0 [D34]
/** Photo jointe au plus (au-dela, la recette part sans photo). */
const PHOTO_MAX_BYTES = 15 * 1024 * 1024;

const unitSelect = {
  select: {
    code: true,
    translations: { where: { locale: LOCALE }, select: { abbreviation: true } },
  },
} as const;
const tagSelect = {
  select: {
    name: true,
    deletedAt: true,
    translations: { where: { locale: LOCALE }, select: { name: true } },
  },
} as const;

const recipeInclude = {
  author: { select: { username: true } },
  homeSpace: { select: { name: true } },
  yieldUnit: unitSelect,
  globalTags: { select: { tag: tagSelect } },
  spaceTags: { select: { spaceId: true, tag: tagSelect } },
  blocks: {
    orderBy: { position: "asc" as const },
    include: {
      subUnit: unitSelect,
      subRecipe: { select: { id: true, title: true, deletedAt: true } },
      ingredients: {
        orderBy: { position: "asc" as const },
        include: {
          unit: unitSelect,
          ingredient: {
            select: { translations: { where: { locale: LOCALE }, select: { name: true } } },
          },
        },
      },
      steps: { orderBy: { position: "asc" as const }, select: { text: true } },
    },
  },
} satisfies Prisma.RecipeInclude;

type RecipeRow = Prisma.RecipeGetPayload<{ include: typeof recipeInclude }>;
type UnitRow = { code: string; translations: { abbreviation: string }[] } | null;

/** Recettes exportees : les siennes ("Mes recettes"), ou celles visibles dans l'espace. */
async function selectedIds(ctx: Context, request: ExportRequest): Promise<string[]> {
  const where =
    request.scope === "SPACE" && request.spaceId
      ? Prisma.sql`${visibleInSql(request.spaceId)}
          AND (r."hiddenAt" IS NULL OR r."authorId" = ${request.userId})`
      : authoredBySql(request.userId);
  const rows = await ctx.db.$queryRaw<{ id: string }[]>`
    SELECT r.id FROM "Recipe" r WHERE r."deletedAt" IS NULL AND ${where}
    ORDER BY r."createdAt", r.id`;
  return rows.map((row) => row.id);
}

/** Recettes choisies puis sous-recettes liees (vivantes, non masquees), niveau par niveau. */
async function loadRecipes(ctx: Context, ids: string[]): Promise<RecipeRow[]> {
  const loaded: RecipeRow[] = [];
  const seen = new Set<string>();
  let next = ids;
  while (next.length > 0) {
    next.forEach((id) => seen.add(id));
    const rows = await ctx.db.recipe.findMany({
      where: { id: { in: next }, deletedAt: null },
      include: recipeInclude,
    });
    const order = new Map(next.map((id, at) => [id, at]));
    rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    loaded.push(...rows);
    const linked = rows.flatMap((row) =>
      row.blocks.flatMap((block) =>
        block.subRecipe && !block.subRecipe.deletedAt && !seen.has(block.subRecipe.id)
          ? [block.subRecipe.id]
          : []
      )
    );
    const hidden = new Set(
      (
        await ctx.db.recipe.findMany({
          where: { id: { in: linked }, hiddenAt: { not: null } },
          select: { id: true },
        })
      ).map((row) => row.id)
    );
    next = [...new Set(linked)].filter((id) => !hidden.has(id));
  }
  return loaded;
}

function slugOf(title: string): string {
  const slug = normalizeName(title)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  return slug || "recette";
}

/** Reference unique dans l'archive : le titre, puis -2, -3... */
function assignRefs(rows: readonly RecipeRow[]): Map<string, string> {
  const refs = new Map<string, string>();
  const taken = new Set<string>();
  for (const row of rows) {
    const base = slugOf(row.title);
    let ref = base;
    for (let n = 2; taken.has(ref); n++) ref = `${base}-${String(n)}`;
    taken.add(ref);
    refs.set(row.id, ref);
  }
  return refs;
}

const tagName = (tag: RecipeRow["globalTags"][number]["tag"]) =>
  tag.translations[0]?.name ?? tag.name;

function toExported(
  row: RecipeRow,
  refs: ReadonlyMap<string, string>,
  tagSpaceId: string,
  photo: string | null
): ExportedRecipe {
  const tags = [
    ...row.globalTags.map((link) => link.tag),
    ...row.spaceTags.filter((link) => link.spaceId === tagSpaceId).map((link) => link.tag),
  ]
    .filter((tag) => !tag.deletedAt)
    .map(tagName)
    .sort((a, b) => a.localeCompare(b, "fr"));
  const blocks: ExportedBlock[] = row.blocks.map((block) =>
    block.kind === "RECIPE"
      ? {
          kind: "RECIPE",
          title: block.title,
          recipe: block.subRecipe ? (refs.get(block.subRecipe.id) ?? null) : null,
          recipeTitle: block.subRecipe?.title ?? "",
          quantity: block.subQuantity ?? 1,
          unit: block.subUnit?.code ?? null,
        }
      : {
          kind: "LOCAL",
          title: block.title,
          ingredients: block.ingredients.map((line) => ({
            name: line.ingredient.translations[0]?.name ?? "?",
            quantity: line.quantity,
            unit: line.unit?.code ?? null,
            note: line.note,
            optional: line.optional,
          })),
          steps: block.steps.map((step) => step.text),
        }
  );
  return {
    ref: refs.get(row.id) ?? slugOf(row.title),
    title: row.title,
    description: row.description,
    author: row.author.username,
    space: row.homeSpace.name,
    isBase: row.isBase,
    yield: { quantity: row.yieldQuantity, unit: row.yieldUnit?.code ?? null },
    prepMinutes: row.prepMinutes,
    cookMinutes: row.cookMinutes,
    restMinutes: row.restMinutes,
    tags,
    blocks,
    notes: row.notes,
    sourceUrl: row.sourceUrl,
    photo,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// --- Markdown ---

function abbreviation(unit: UnitRow): string | null {
  return unit ? (unit.translations[0]?.abbreviation ?? unit.code) : null;
}

function amount(quantity: number | null, unit: UnitRow): string {
  if (quantity === null) return "";
  const abbr = abbreviation(unit);
  return `${formatQuantity(quantity)}${abbr ? ` ${abbr}` : ""} `;
}

function toMarkdown(row: RecipeRow, recipe: ExportedRecipe): string {
  const lines: string[] = [`# ${recipe.title}`, ""];
  if (recipe.photo) lines.push(`![${recipe.title}](${recipe.photo})`, "");
  if (recipe.description) lines.push(recipe.description, "");
  const yieldText = row.yieldUnit
    ? `${formatQuantity(row.yieldQuantity)} ${abbreviation(row.yieldUnit) ?? ""}`.trim()
    : `${formatQuantity(row.yieldQuantity)} pers.`;
  const times = [
    recipe.prepMinutes ? `préparation ${String(recipe.prepMinutes)} min` : null,
    recipe.cookMinutes ? `cuisson ${String(recipe.cookMinutes)} min` : null,
    recipe.restMinutes ? `repos ${String(recipe.restMinutes)} min` : null,
  ].filter(Boolean);
  lines.push([yieldText, ...times].join(" · "), "");
  if (recipe.isBase) lines.push("Recette de base.", "");
  if (recipe.tags.length > 0) lines.push(`Tags : ${recipe.tags.join(", ")}`, "");

  lines.push("## Ingrédients", "");
  row.blocks.forEach((block, at) => {
    const exported = recipe.blocks[at];
    if (block.title) lines.push(`### ${block.title}`, "");
    if (exported?.kind === "RECIPE") {
      const name = exported.recipe
        ? `[${exported.recipeTitle}](${exported.recipe}.md)`
        : exported.recipeTitle;
      lines.push(`- ${amount(exported.quantity, block.subUnit)}${name}`, "");
      return;
    }
    for (const line of block.ingredients) {
      const name = line.ingredient.translations[0]?.name ?? "?";
      const extra = [line.note, line.optional ? "facultatif" : null].filter(Boolean).join(", ");
      const unitOnly =
        line.quantity === null && line.unit ? `, ${abbreviation(line.unit) ?? ""}` : "";
      lines.push(
        `- ${amount(line.quantity, line.unit)}${name}${unitOnly}${extra ? ` (${extra})` : ""}`
      );
    }
    lines.push("");
  });

  const withSteps = row.blocks.filter((block) => block.steps.length > 0);
  if (withSteps.length > 0) {
    lines.push("## Étapes", "");
    for (const block of withSteps) {
      if (block.title && withSteps.length > 1) lines.push(`### ${block.title}`, "");
      block.steps.forEach((step, at) => lines.push(`${String(at + 1)}. ${step.text}`));
      lines.push("");
    }
  }
  if (recipe.notes) lines.push("## Notes", "", recipe.notes, "");
  if (recipe.sourceUrl) lines.push(`Source : ${recipe.sourceUrl}`, "");
  lines.push(`Par ${recipe.author} · ${recipe.space}`, "");
  return lines.join("\n");
}

export async function exportRecipes(ctx: Context, request: ExportRequest): Promise<ArchiveFile[]> {
  const rows = await loadRecipes(ctx, await selectedIds(ctx, request));
  const refs = assignRefs(rows);
  const files: ArchiveFile[] = [];
  const recipes: ExportedRecipe[] = [];
  for (const row of rows) {
    const ref = refs.get(row.id) ?? slugOf(row.title);
    let photo: string | null = null;
    if (request.photos && row.imageKey && ctx.storage) {
      const data = await ctx.storage.read(row.imageKey, PHOTO_MAX_BYTES);
      if (data) {
        photo = `photos/${ref}.${row.imageKey.split(".").at(-1) ?? "webp"}`;
        files.push({ path: photo, data: new Uint8Array(data) });
      }
    }
    const exported = toExported(row, refs, request.spaceId ?? row.homeSpaceId, photo);
    recipes.push(exported);
    if (request.format === "MARKDOWN") {
      files.push({ path: `${ref}.md`, data: strToU8(toMarkdown(row, exported)) });
    }
  }
  if (request.format === "JSON") {
    const archive: RecipesExport = {
      format: RECIPES_EXPORT_FORMAT,
      version: RECIPES_EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      recipes,
    };
    files.unshift({ path: "recettes.json", data: strToU8(JSON.stringify(archive, null, 2)) });
  }
  return files;
}
