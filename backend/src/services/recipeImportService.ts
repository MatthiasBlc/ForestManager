import * as cheerio from "cheerio";
import createHttpError from "http-errors";

// --- Types ---

export interface ParsedIngredient {
  raw: string;
  quantity: number | null;
  unitAbbreviation: string | null;
  name: string | null;
}

export interface ParsedRecipe {
  title: string | null;
  servings: number | null;
  prepTime: number | null;
  cookTime: number | null;
  restTime: number | null;
  ingredients: ParsedIngredient[];
  steps: string[];
}

// --- Unit mapping ---

const UNIT_ALIAS_MAP: Record<string, string> = {
  // Poids
  g: "g",
  gr: "g",
  gramme: "g",
  grammes: "g",
  kg: "kg",
  kilo: "kg",
  kilos: "kg",
  kilogramme: "kg",
  kilogrammes: "kg",
  // Volumes
  ml: "ml",
  millilitre: "ml",
  millilitres: "ml",
  cl: "cl",
  centilitre: "cl",
  centilitres: "cl",
  dl: "dl",
  decilitre: "dl",
  decilitres: "dl",
  l: "l",
  litre: "l",
  litres: "l",
  // Cuilleres (abbreviation DB = "cac" et "cas")
  cs: "cas",
  cas: "cas",
  "c.a.s": "cas",
  "cuillere a soupe": "cas",
  "cuilleres a soupe": "cas",
  cc: "cac",
  cac: "cac",
  "c.a.c": "cac",
  "cuillere a cafe": "cac",
  "cuilleres a cafe": "cac",
  // Unites discretes
  pincee: "pincee",
  pincees: "pincee",
  gousse: "gousse",
  gousses: "gousse",
  tranche: "tranche",
  tranches: "tranche",
  feuille: "feuille",
  feuilles: "feuille",
  brin: "brin",
  brins: "brin",
  botte: "botte",
  bottes: "botte",
  piece: "piece",
  pieces: "piece",
};

// Tous les patterns d'unites reconnus (tries par longueur decroissante pour le regex)
const UNIT_PATTERNS = Object.keys(UNIT_ALIAS_MAP)
  .sort((a, b) => b.length - a.length)
  .join("|");

// --- SSRF protection ---

const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^\[::1\]$/,
  /^localhost$/i,
];

function isPrivateHost(hostname: string): boolean {
  return PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(hostname));
}

// --- ISO 8601 duration parsing ---

export function parseIsoDuration(duration: string | null | undefined): number | null {
  if (!duration || typeof duration !== "string") return null;
  const match = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/i);
  if (!match) return null;
  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const total = hours * 60 + minutes;
  return total > 0 ? total : null;
}

// --- Unicode fraction normalization ---

const UNICODE_FRACTIONS: Record<string, string> = {
  "\u00BD": "1/2", "\u2153": "1/3", "\u2154": "2/3", "\u00BC": "1/4", "\u00BE": "3/4",
  "\u2155": "1/5", "\u2156": "2/5", "\u2157": "3/5", "\u2158": "4/5",
  "\u2159": "1/6", "\u215A": "5/6", "\u215B": "1/8", "\u215C": "3/8", "\u215D": "5/8", "\u215E": "7/8",
};

function normalizeUnicodeFractions(text: string): string {
  return text.replace(/[\u00BC\u00BD\u00BE\u2153-\u215E]/g, (ch) => UNICODE_FRACTIONS[ch] ?? ch);
}

// --- Ingredient parsing ---

export function parseIngredientLine(line: string): ParsedIngredient {
  const cleaned = normalizeUnicodeFractions(
    line.replace(/^[-*\u2022\u2013\u2014]\s*/, "")
  ).trim();

  if (!cleaned) {
    return { raw: line, quantity: null, unitAbbreviation: null, name: null };
  }

  // Variante "a gout" / sans quantite
  const tasteMatch = cleaned.match(
    /^(.+?)[\s,]*(?:[aà]\s*go[uû]t|selon\s*(?:besoin|envie|go[uû]t))$/i,
  );
  if (tasteMatch) {
    return {
      raw: cleaned,
      quantity: null,
      unitAbbreviation: null,
      name: tasteMatch[1].trim(),
    };
  }

  // Variante fractions en premier (1/2, 3/4) pour eviter que "1" de "1/2" matche le pattern principal
  const fractionPattern = new RegExp(
    `^(\\d+/\\d+)\\s*(${UNIT_PATTERNS})?\\s*(?:de\\s+|d')?(.+)$`,
    "i",
  );
  const fractionMatch = cleaned.match(fractionPattern);
  if (fractionMatch) {
    const [num, den] = fractionMatch[1].split("/");
    const quantity = parseInt(num, 10) / parseInt(den, 10);
    const unitRaw = fractionMatch[2]?.toLowerCase() || null;
    const unitAbbreviation = unitRaw ? (UNIT_ALIAS_MAP[unitRaw] || null) : null;
    return {
      raw: cleaned,
      quantity: isNaN(quantity) ? null : quantity,
      unitAbbreviation,
      name: fractionMatch[3].trim(),
    };
  }

  // Pattern principal : nombre (entier/decimal) + unite optionnelle + nom
  const mainPattern = new RegExp(
    `^(\\d+[.,]?\\d*)\\s*(${UNIT_PATTERNS})?\\s*(?:de\\s+|d')?(.+)$`,
    "i",
  );
  const mainMatch = cleaned.match(mainPattern);
  if (mainMatch) {
    const quantity = parseFloat(mainMatch[1].replace(",", "."));
    const unitRaw = mainMatch[2]?.toLowerCase() || null;
    const unitAbbreviation = unitRaw ? (UNIT_ALIAS_MAP[unitRaw] || null) : null;
    return {
      raw: cleaned,
      quantity: isNaN(quantity) ? null : quantity,
      unitAbbreviation,
      name: mainMatch[3].trim(),
    };
  }

  // Fallback : pas de match
  return { raw: cleaned, quantity: null, unitAbbreviation: null, name: cleaned };
}

// --- recipeInstructions parsing ---

function parseInstructions(instructions: unknown): string[] {
  if (!instructions) return [];

  // String unique
  if (typeof instructions === "string") {
    return instructions
      .split(/\n/)
      .map((s) => s.replace(/^\d+[\.\)]\s*/, "").trim())
      .filter(Boolean);
  }

  // Array
  if (Array.isArray(instructions)) {
    const steps: string[] = [];

    for (const item of instructions) {
      if (typeof item === "string") {
        const trimmed = item.replace(/^\d+[\.\)]\s*/, "").trim();
        if (trimmed) steps.push(trimmed);
      } else if (item && typeof item === "object") {
        // HowToStep
        if (item["@type"] === "HowToStep" || item["@type"] === "schema:HowToStep") {
          const text = (item.text || item.name || "").toString().trim();
          if (text) steps.push(text);
        }
        // HowToSection
        else if (item["@type"] === "HowToSection" || item["@type"] === "schema:HowToSection") {
          const sectionItems = item.itemListElement;
          if (Array.isArray(sectionItems)) {
            for (const subItem of sectionItems) {
              if (typeof subItem === "string") {
                const trimmed = subItem.trim();
                if (trimmed) steps.push(trimmed);
              } else if (subItem && typeof subItem === "object") {
                const text = (subItem.text || subItem.name || "").toString().trim();
                if (text) steps.push(text);
              }
            }
          }
        }
        // Objet generique avec .text
        else if ("text" in item) {
          const text = (item.text || "").toString().trim();
          if (text) steps.push(text);
        }
      }
    }

    return steps;
  }

  return [];
}

// --- JSON-LD Recipe extraction ---

/* eslint-disable @typescript-eslint/no-explicit-any */
function findRecipeInJsonLd(data: any): any | null {
  if (!data || typeof data !== "object") return null;

  // Verifier si l'objet lui-meme est une Recipe
  if (isRecipeType(data)) return data;

  // Chercher dans @graph
  if (Array.isArray(data["@graph"])) {
    for (const item of data["@graph"]) {
      if (isRecipeType(item)) return item;
    }
  }

  // Chercher dans un tableau direct
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findRecipeInJsonLd(item);
      if (found) return found;
    }
  }

  return null;
}

function isRecipeType(obj: any): boolean {
  if (!obj || typeof obj !== "object") return false;
  const type = obj["@type"];
  if (!type) return false;

  if (typeof type === "string") {
    return type === "Recipe" || type === "schema:Recipe";
  }
  if (Array.isArray(type)) {
    return type.some((t: string) => t === "Recipe" || t === "schema:Recipe");
  }
  return false;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function mapJsonLdToRecipe(recipe: Record<string, unknown>): ParsedRecipe {
  const title = typeof recipe.name === "string" ? recipe.name : null;

  // Servings : extraire le premier nombre
  let servings: number | null = null;
  const yieldValue = recipe.recipeYield;
  if (yieldValue) {
    const yieldStr = Array.isArray(yieldValue) ? String(yieldValue[0]) : String(yieldValue);
    const servingsMatch = yieldStr.match(/(\d+)/);
    if (servingsMatch) {
      servings = parseInt(servingsMatch[1], 10);
    }
  }

  // Temps
  const prepTime = parseIsoDuration(recipe.prepTime as string);
  const cookTime = parseIsoDuration(recipe.cookTime as string);
  const totalTime = parseIsoDuration(recipe.totalTime as string);

  // restTime n'est pas standard en JSON-LD, on ne l'extrait pas
  const restTime: number | null = null;

  // Fallback : si aucun prepTime/cookTime, utiliser totalTime comme prepTime
  const finalPrepTime = prepTime ?? (cookTime ? null : totalTime);

  // Ingredients
  const rawIngredients = Array.isArray(recipe.recipeIngredient) ? recipe.recipeIngredient : [];
  const ingredients: ParsedIngredient[] = rawIngredients
    .filter((item): item is string => typeof item === "string")
    .map((line) => parseIngredientLine(line));

  // Steps
  const steps = parseInstructions(recipe.recipeInstructions);

  return {
    title,
    servings,
    prepTime: finalPrepTime,
    cookTime,
    restTime,
    ingredients,
    steps,
  };
}

// --- Main service function ---

export async function importFromUrl(url: string): Promise<ParsedRecipe> {
  // Validation URL
  if (!url || typeof url !== "string" || url.length > 2000) {
    throw createHttpError(400, "IMPORT_001: Invalid URL format");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw createHttpError(400, "IMPORT_001: Invalid URL format");
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw createHttpError(400, "IMPORT_001: Invalid URL format");
  }

  // SSRF protection
  if (isPrivateHost(parsedUrl.hostname)) {
    throw createHttpError(400, "IMPORT_001: Invalid URL format");
  }

  // Fetch la page
  let html: string;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ForestManager/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });

    clearTimeout(timeout);

    // Verifier la taille du contenu
    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > 5 * 1024 * 1024) {
      throw createHttpError(422, "IMPORT_002: Could not fetch URL");
    }

    if (!response.ok) {
      throw createHttpError(422, "IMPORT_002: Could not fetch URL");
    }

    html = await response.text();

    // Verifier la taille apres telechargement aussi
    if (html.length > 5 * 1024 * 1024) {
      throw createHttpError(422, "IMPORT_002: Could not fetch URL");
    }
  } catch (error) {
    if (error instanceof Error && "statusCode" in error) {
      throw error; // Re-throw createHttpError
    }
    throw createHttpError(422, "IMPORT_002: Could not fetch URL");
  }

  // Extraire les JSON-LD
  const $ = cheerio.load(html);
  const jsonLdScripts = $('script[type="application/ld+json"]');

  let recipeData: Record<string, unknown> | null = null;

  jsonLdScripts.each((_, element) => {
    if (recipeData) return; // Deja trouve

    try {
      const content = $(element).html();
      if (!content) return;

      const parsed = JSON.parse(content);
      const found = findRecipeInJsonLd(parsed);
      if (found) {
        recipeData = found;
      }
    } catch {
      // JSON invalide, on continue
    }
  });

  if (!recipeData) {
    throw createHttpError(422, "IMPORT_003: No recipe data found");
  }

  return mapJsonLdToRecipe(recipeData);
}
