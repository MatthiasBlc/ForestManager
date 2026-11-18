// Reimport d'un export de recettes [D192, D225] : corps de la route et reponse.
import { describe, expect, it } from "vitest";

import { ERRORS } from "../src/errors/index.ts";
import {
  IMPORT_EXPORT_MAX,
  importExportBodySchema,
  importExportPreviewBodySchema,
  importExportPreviewSchema,
  importExportResultSchema,
  recipesExportSchema,
  type ExportedRecipe,
} from "../src/schemas/index.ts";

function recipe(ref: string, extra: Partial<ExportedRecipe> = {}): ExportedRecipe {
  return {
    ref,
    title: `Recette ${ref}`,
    description: null,
    author: "alice",
    space: "Famille",
    isBase: false,
    yield: { quantity: 4, unit: null },
    prepMinutes: 10,
    cookMinutes: null,
    restMinutes: null,
    tags: ["Hiver"],
    blocks: [
      {
        kind: "LOCAL",
        title: null,
        ingredients: [{ name: "farine", quantity: 200, unit: "g", note: null, optional: false }],
        steps: ["Melanger."],
      },
    ],
    notes: null,
    sourceUrl: null,
    photo: null,
    createdAt: "2026-11-01T10:00:00.000Z",
    updatedAt: "2026-11-02T10:00:00.000Z",
    ...extra,
  };
}

describe("importExportBodySchema", () => {
  it("accepte les recettes telles que lues dans recettes.json", () => {
    const archive = recipesExportSchema.parse({
      format: "forest-manager/recipes",
      version: 1,
      exportedAt: "2026-11-18T10:00:00.000Z",
      recipes: [recipe("pate"), recipe("tarte")],
    });
    expect(importExportBodySchema.parse({ recipes: archive.recipes }).recipes).toHaveLength(2);
  });

  it("borne le lot : au moins une recette, au plus IMPORT_EXPORT_MAX", () => {
    expect(IMPORT_EXPORT_MAX).toBe(200);
    expect(importExportBodySchema.safeParse({ recipes: [] }).success).toBe(false);
    const many = Array.from({ length: IMPORT_EXPORT_MAX + 1 }, (_, at) => recipe(`r-${at}`));
    expect(importExportBodySchema.safeParse({ recipes: many }).success).toBe(false);
    expect(
      importExportBodySchema.safeParse({ recipes: many.slice(0, IMPORT_EXPORT_MAX) }).success
    ).toBe(true);
  });

  it("refuse deux recettes de meme reference et les champs inconnus", () => {
    expect(importExportBodySchema.safeParse({ recipes: [recipe("a"), recipe("a")] }).success).toBe(
      false
    );
    expect(importExportBodySchema.safeParse({ recipes: [recipe("a")], spaceId: "x" }).success).toBe(
      false
    );
  });

  it("reprend les bornes d'une recette (titre, blocs, lignes)", () => {
    const long = recipe("a", { title: "x".repeat(121) });
    expect(importExportBodySchema.safeParse({ recipes: [long] }).success).toBe(false);
    const noBlock = recipe("a", { blocks: [] });
    expect(importExportBodySchema.safeParse({ recipes: [noBlock] }).success).toBe(false);
  });
});

describe("importExportResultSchema", () => {
  it("associe chaque reference a la recette creee", () => {
    const result = { data: [{ ref: "pate", recipeId: "00000000-0000-4000-8000-000000000000" }] };
    expect(importExportResultSchema.parse(result)).toEqual(result);
  });
});

describe("apercu du reimport", () => {
  it("envoie les titres de l'archive (1 a IMPORT_EXPORT_MAX) et recoit ceux deja presents", () => {
    expect(importExportPreviewBodySchema.safeParse({ titles: [] }).success).toBe(false);
    const titles = Array.from({ length: IMPORT_EXPORT_MAX + 1 }, (_, at) => `T${at}`);
    expect(importExportPreviewBodySchema.safeParse({ titles }).success).toBe(false);
    expect(importExportPreviewBodySchema.parse({ titles: ["Tarte"] })).toEqual({
      titles: ["Tarte"],
    });
    expect(importExportPreviewSchema.parse({ existing: ["Tarte"] })).toEqual({
      existing: ["Tarte"],
    });
  });
});

describe("codes erreur du reimport", () => {
  it("archive illisible et sous-recettes en boucle", () => {
    expect(ERRORS.RECIPE_022.status).toBe(422);
    expect(ERRORS.RECIPE_023.status).toBe(422);
  });
});
