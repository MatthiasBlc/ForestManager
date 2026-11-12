// Import d'une recette par lien (C3.8) : page lue par l'API (anti-SSRF),
// recette JSON-LD convertie par la logique partagee. Rien n'est enregistre :
// le front ouvre l'editeur pre-rempli, l'enregistrement cree une revision IMPORT.
import {
  extractJsonLd,
  findJsonLdRecipe,
  fromJsonLd,
  RECIPE_URL_MAX,
  type ImportedRecipe,
} from "@fm/shared";

import type { Context } from "../../core/context.ts";
import { AppError } from "../../core/http/errors.ts";
import { PageFetchError, type FetchedPage } from "../../core/net/page-fetcher.ts";

const FAILURES = {
  BLOCKED: "RECIPE_015",
  UNREACHABLE: "RECIPE_016",
  NOT_HTML: "RECIPE_017",
} as const;

export async function importFromUrl(ctx: Context, url: string): Promise<ImportedRecipe> {
  let page: FetchedPage;
  try {
    page = await ctx.fetchPage(url);
  } catch (error) {
    if (error instanceof PageFetchError) throw new AppError(FAILURES[error.reason]);
    throw error;
  }
  const recipe = findJsonLdRecipe(extractJsonLd(page.html));
  if (!recipe) throw new AppError("RECIPE_017");
  return fromJsonLd(recipe, page.url.length <= RECIPE_URL_MAX ? page.url : url);
}
