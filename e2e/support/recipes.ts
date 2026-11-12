// Recettes creees par l'API avec la session de la page : etat de depart d'un
// parcours qui ne porte pas sur la saisie (celle-ci est jouee par le parcours 1).
import type { Page } from "@playwright/test";

import { apiCall, apiCreate, expect } from "./test.ts";

export interface RecipeInput {
  title: string;
  /** Quantite, code d'unite du referentiel ("g", "kg", "piece"...) et nom de l'ingredient. */
  ingredients?: [quantity: number, unit: string, name: string][];
  steps?: string[];
}

async function unitIds(page: Page): Promise<Map<string, string>> {
  const response = await page.context().request.get("/api/v1/units");
  expect(response.status(), "GET /units").toBe(200);
  const units = (await response.json()) as { data: { id: string; code: string }[] };
  return new Map(units.data.map((unit) => [unit.code, unit.id]));
}

/** Cree une recette dans l'espace, au nom du compte connecte dans la page. */
export async function createRecipe(
  page: Page,
  spaceId: string,
  { title, ingredients = [[500, "g", "Farine"]], steps = ["Tout melanger."] }: RecipeInput
): Promise<{ id: string }> {
  const units = await unitIds(page);
  const lines = [];
  for (const [quantity, unit, name] of ingredients) {
    const response = await apiCall(page, "POST", "/ingredients", { name });
    expect([200, 201], `POST /ingredients ${name}`).toContain(response.status());
    const { id } = (await response.json()) as { id: string };
    const unitId = units.get(unit);
    if (!unitId) throw new Error(`unknown unit code: ${unit}`);
    lines.push({ ingredientId: id, quantity, unitId });
  }
  return apiCreate(page, `/spaces/${spaceId}/recipes`, {
    title,
    yieldQuantity: 4,
    prepMinutes: 15,
    cookMinutes: 30,
    blocks: [{ kind: "LOCAL", ingredients: lines, steps }],
  });
}
