// Fabriques des tests Recettes : corps de recette valable et creation par l'API.
import type { Client } from "./app.ts";
import { db } from "./db.ts";

export async function unitId(code: string): Promise<string> {
  return (await db.unit.findUniqueOrThrow({ where: { code } })).id;
}

export async function ingredient(client: Client, name: string): Promise<string> {
  return (await client.post("/ingredients", { name })).body.id as string;
}

/** Corps minimal valable, complete par `overrides`. */
export async function recipeBody(client: Client, overrides: Record<string, unknown> = {}) {
  return {
    title: "Gratin de pates",
    yieldQuantity: 4,
    prepMinutes: 15,
    cookMinutes: 30,
    blocks: [
      {
        kind: "LOCAL",
        ingredients: [
          {
            ingredientId: await ingredient(client, "Pâtes"),
            quantity: 500,
            unitId: await unitId("g"),
          },
          {
            ingredientId: await ingredient(client, "Sel"),
            quantity: null,
            unitId: await unitId("to-taste"),
          },
        ],
        steps: ["Cuire les pates.", "Gratiner 20 min."],
      },
    ],
    ...overrides,
  };
}

export async function createRecipe(
  client: Client,
  spaceId: string,
  overrides: Record<string, unknown> = {}
) {
  const res = await client.post(`/spaces/${spaceId}/recipes`, await recipeBody(client, overrides));
  if (res.status !== 201) throw new Error(`create failed: ${JSON.stringify(res.body)}`);
  return res.body as { id: string; currentRevision: number };
}
