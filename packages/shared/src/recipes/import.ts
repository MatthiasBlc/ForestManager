// Import de recettes (C3.8) : logique pure partagee par l'API (pages web,
// JSON-LD schema.org/Recipe) et le front (texte colle). Le resultat ouvre
// l'editeur pre-rempli : rien n'est enregistre sans relecture.
import {
  RECIPE_INGREDIENT_NOTE_MAX,
  RECIPE_LINES_MAX,
  RECIPE_STEP_MAX,
  RECIPE_TITLE_MAX,
  RECIPE_YIELD_MAX,
} from "../schemas/recipes.ts";

export interface ImportedIngredient {
  /** Ligne d'origine, nettoyee. */
  raw: string;
  quantity: number | null;
  /** Code d'unite du referentiel (g, tbsp, to-taste...), null sans unite. */
  unitCode: string | null;
  name: string;
  note: string | null;
  /** Quantite absente ou approximative : a verifier dans l'editeur. */
  check: boolean;
}

export interface ImportedRecipe {
  title: string | null;
  yieldQuantity: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  restMinutes: number | null;
  sourceUrl: string | null;
  ingredients: ImportedIngredient[];
  steps: string[];
}

// --- Texte ---

const FRACTIONS: Record<string, string> = {
  "½": "1/2",
  "⅓": "1/3",
  "⅔": "2/3",
  "¼": "1/4",
  "¾": "3/4",
  "⅕": "1/5",
  "⅛": "1/8",
};

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  deg: "°",
  rsquo: "’",
  lsquo: "‘",
  laquo: "«",
  raquo: "»",
  hellip: "…",
  oelig: "œ",
  eacute: "é",
  egrave: "è",
  ecirc: "ê",
  agrave: "à",
  acirc: "â",
  ccedil: "ç",
  icirc: "î",
  ocirc: "ô",
  ucirc: "û",
  ugrave: "ù",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    }
    if (entity.startsWith("#")) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    return ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/** Une ligne lisible : entites decodees, balises retirees, espaces reduits. */
function cleanText(text: string): string {
  return decodeEntities(text.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/** Texte HTML d'etapes : un element de liste ou un paragraphe par ligne. */
function htmlToLines(text: string): string[] {
  const items = [...text.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => m[1] ?? "");
  const parts =
    items.length > 0 ? items : text.split(/<br\s*\/?>|<\/p>|<\/div>|\n/i).filter(Boolean);
  return parts.map(cleanText).filter(Boolean);
}

function normalizeLine(line: string): string {
  return line
    .replace(/(\d)\s*([½⅓⅔¼¾⅕⅛])/g, "$1 $2")
    .replace(/[½⅓⅔¼¾⅕⅛]/g, (char) => FRACTIONS[char] ?? char)
    .replace(/\s+/g, " ")
    .trim();
}

const clip = (text: string, max: number) => (text.length > max ? text.slice(0, max).trim() : text);

// --- Lignes d'ingredients ---

/** Unites reconnues -> code du referentiel ; `factor` convertit (dl -> cl). */
const UNIT_LIST: { pattern: string; code: string; factor?: number }[] = [
  { pattern: "cuill(?:[eè]re)?s?\\.?\\s+(?:[aà]\\s+)?soupe", code: "tbsp" },
  { pattern: "cuill(?:[eè]re)?s?\\.?\\s+(?:[aà]\\s+)?caf[eé]", code: "tsp" },
  { pattern: "c\\.?\\s*[aà]\\.?\\s*soupe", code: "tbsp" },
  { pattern: "c\\.?\\s*[aà]\\.?\\s*caf[eé]", code: "tsp" },
  { pattern: "c\\.?\\s*[aà]\\.?\\s*s\\.?", code: "tbsp" },
  { pattern: "c\\.?\\s*[aà]\\.?\\s*c\\.?", code: "tsp" },
  { pattern: "cs|tbsp|cas", code: "tbsp" },
  { pattern: "cc|tsp|cac", code: "tsp" },
  { pattern: "kilogrammes?|kilos?|kg", code: "kg" },
  { pattern: "grammes?|gr|g", code: "g" },
  { pattern: "millilitres?|ml", code: "ml" },
  { pattern: "centilitres?|cl", code: "cl" },
  { pattern: "d[eé]cilitres?|dl", code: "cl", factor: 10 },
  { pattern: "litres?|l", code: "l" },
  { pattern: "tasses?|cups?", code: "cup" },
  { pattern: "pi[eè]ces?(?:\\(s\\))?|pi[eè]ce\\(s\\)|pces?", code: "piece" },
  { pattern: "tranches?(?:\\(s\\))?", code: "slice" },
  { pattern: "gousses?(?:\\(s\\))?", code: "clove" },
  { pattern: "bottes?(?:\\(s\\))?|bouquets?", code: "bunch" },
  { pattern: "bo[iî]tes?(?:\\(s\\))?", code: "can" },
  { pattern: "sachets?(?:\\(s\\))?", code: "sachet" },
  { pattern: "pinc[eé]es?(?:\\(s\\))?", code: "pinch" },
];
const UNIT_PATTERNS = UNIT_LIST.map((unit) => ({
  ...unit,
  regex: new RegExp(`^(?:${unit.pattern})(?![\\p{L}])\\s*`, "iu"),
}));

const TASTE =
  "(?:[aà]\\s+go[uû]t|selon\\s+(?:le\\s+|la\\s+|votre\\s+)?(?:go[uû]t|besoin|envie)|q\\.?s\\.?)";
const TASTE_PREFIX = new RegExp(`^${TASTE}\\s+(.+)$`, "iu");
const TASTE_SUFFIX = new RegExp(`^(.+?)[\\s,]*${TASTE}$`, "iu");
const QUANTITY =
  /^(\d+(?:[.,]\d+)?\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?)(?:\s*(?:-|–|à)\s*\d+(?:[.,]\d+)?)?\s*/u;
const BULLET = /^[-*•–—·]\s*/u;
const PARTICLE = /^(?:de\s+|d['’]\s*|of\s+)/iu;

function toNumber(text: string): number | null {
  const parts = text.trim().split(/\s+/);
  let total = 0;
  for (const part of parts) {
    const [num, den] = part.split("/");
    const value = den ? Number(num) / Number(den) : Number(part.replace(",", "."));
    if (!Number.isFinite(value)) return null;
    total += value;
  }
  return total > 0 ? Math.round(total * 1000) / 1000 : null;
}

function splitNote(text: string): { name: string; note: string | null } {
  const comma = text.indexOf(",");
  if (comma <= 0) return { name: text.trim(), note: null };
  const note = text.slice(comma + 1).trim();
  return {
    name: text.slice(0, comma).trim(),
    note: note ? clip(note, RECIPE_INGREDIENT_NOTE_MAX) : null,
  };
}

export function parseIngredientLine(line: string): ImportedIngredient {
  const raw = normalizeLine(cleanText(line)).replace(BULLET, "");
  const base = { raw, quantity: null, unitCode: null, note: null };

  const taste = TASTE_PREFIX.exec(raw) ?? TASTE_SUFFIX.exec(raw);
  if (taste?.[1]) {
    return { ...base, unitCode: "to-taste", ...splitNote(taste[1]), check: false };
  }

  const quantity = QUANTITY.exec(raw);
  if (!quantity?.[1]) {
    const { name, note } = splitNote(raw);
    return { ...base, name: name || raw, note, check: true };
  }
  const range = /[-–à]/u.test(quantity[0].slice(quantity[1].length));
  let value = toNumber(quantity[1]);
  let rest = raw.slice(quantity[0].length);
  let unitCode: string | null = null;
  for (const unit of UNIT_PATTERNS) {
    const match = unit.regex.exec(rest);
    if (match) {
      unitCode = unit.code;
      if (value !== null && unit.factor) value = value * unit.factor;
      rest = rest.slice(match[0].length).replace(PARTICLE, "");
      break;
    }
  }
  const { name, note } = splitNote(rest);
  return {
    raw,
    quantity: value,
    unitCode,
    name: name || raw,
    note,
    check: value === null || range || !name,
  };
}

// --- Durees ---

/** Duree ISO 8601 (PT1H30M, P0DT20M) en minutes ; null si absente ou nulle. */
export function parseDuration(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:\d+S)?$/i.exec(value.trim());
  if (!match || value.trim().toUpperCase() === "P") return null;
  const minutes = Number(match[1] ?? 0) * 1440 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
  return minutes > 0 ? minutes : null;
}

/** Duree ecrite (15 min, 1h05, 1 h 30, 2 heures) en minutes. */
function parseTextDuration(text: string): number | null {
  const match =
    /^(?:(\d+)\s*h(?:eures?)?\s*(?:(\d+)\s*(?:min(?:utes?)?)?)?|(\d+)\s*min(?:utes?|\.)?)$/i.exec(
      text.trim()
    );
  if (!match) return null;
  const minutes = match[3] ? Number(match[3]) : Number(match[1]) * 60 + Number(match[2] ?? 0);
  return minutes > 0 ? minutes : null;
}

// --- JSON-LD ---

/** Contenus des blocs <script type="application/ld+json"> lisibles. */
export function extractJsonLd(html: string): unknown[] {
  const blocks: unknown[] = [];
  const scripts = html.matchAll(
    /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi
  );
  for (const [, content] of scripts) {
    try {
      blocks.push(JSON.parse(content ?? ""));
    } catch {
      // Bloc invalide : on passe au suivant.
    }
  }
  return blocks;
}

function isRecipe(value: Record<string, unknown>): boolean {
  const type = value["@type"];
  const types = Array.isArray(type) ? type : [type];
  return types.some((t) => typeof t === "string" && /(?:^|[:/])Recipe$/.test(t));
}

/** Premiere recette des blocs JSON-LD (objet, @graph, tableau, mainEntity). */
export function findJsonLdRecipe(blocks: unknown, depth = 0): Record<string, unknown> | null {
  if (depth > 6 || !blocks || typeof blocks !== "object") return null;
  if (Array.isArray(blocks)) {
    for (const item of blocks) {
      const found = findJsonLdRecipe(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  const value = blocks as Record<string, unknown>;
  if (isRecipe(value)) return value;
  return (
    findJsonLdRecipe(value["@graph"], depth + 1) ?? findJsonLdRecipe(value.mainEntity, depth + 1)
  );
}

function textOf(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function instructionLines(value: unknown): string[] {
  if (typeof value === "string") return htmlToLines(value);
  if (Array.isArray(value)) return value.flatMap(instructionLines);
  if (!value || typeof value !== "object") return [];
  const item = value as Record<string, unknown>;
  if (item.itemListElement) return instructionLines(item.itemListElement);
  return htmlToLines(textOf(item.text) || textOf(item.name));
}

function yieldOf(value: unknown): number | null {
  for (const item of Array.isArray(value) ? value : [value]) {
    const match = /(\d+(?:[.,]\d+)?)/.exec(textOf(item));
    const number = match?.[1] ? Number(match[1].replace(",", ".")) : NaN;
    if (number > 0 && number <= RECIPE_YIELD_MAX) return number;
  }
  return null;
}

const stripStepNumber = (step: string) =>
  step.replace(/^(?:[ée]tape\s*\d+\s*[:.)-]?|\d+\s*[.)])\s*/iu, "").trim();

function finish(recipe: ImportedRecipe): ImportedRecipe {
  return {
    ...recipe,
    title: recipe.title ? clip(recipe.title, RECIPE_TITLE_MAX) : null,
    ingredients: recipe.ingredients.filter((i) => i.name).slice(0, RECIPE_LINES_MAX),
    steps: recipe.steps
      .map(stripStepNumber)
      .filter(Boolean)
      .map((step) => clip(step, RECIPE_STEP_MAX))
      .slice(0, RECIPE_LINES_MAX),
  };
}

/** Recette JSON-LD -> recette importee. */
export function fromJsonLd(recipe: unknown, sourceUrl: string | null): ImportedRecipe {
  const data = (recipe && typeof recipe === "object" ? recipe : {}) as Record<string, unknown>;
  const lines = data.recipeIngredient ?? data.ingredients;
  const prep = parseDuration(data.prepTime);
  const cook = parseDuration(data.cookTime);
  return finish({
    title: cleanText(textOf(data.name)) || null,
    yieldQuantity: yieldOf(data.recipeYield),
    // Temps total seul : compte comme preparation.
    prepMinutes: prep ?? (cook === null ? parseDuration(data.totalTime) : null),
    cookMinutes: cook,
    restMinutes: null,
    sourceUrl,
    ingredients: (Array.isArray(lines) ? lines : [])
      .map(textOf)
      .filter(Boolean)
      .map(parseIngredientLine),
    steps: instructionLines(data.recipeInstructions),
  });
}

// --- Texte colle ---

const SEPARATOR = /^[-=_*~#.·]{3,}$/u;
const INGREDIENTS_HEADER = /^ingr[ée]dients?(?:\s+pour\b.*)?\s*:?$/iu;
const STEPS_HEADER =
  /^(?:pr[ée]paration|[ée]tapes?|instructions?|recette|m[ée]thode|d[ée]roul[ée])\s*:?$/iu;
const SERVINGS = [
  /^(?:pour\s+)?(\d+)\s*(?:personnes?|pers\.?|parts?|portions?|couverts?)\b/iu,
  /^(?:portions?|parts?|personnes?|nombre de personnes)\s*:?\s*(\d+)/iu,
];
const TIME = /^(pr[ée]paration|cuisson|repos|temps(?:\s+total)?)\s*:?\s*(.+)$/iu;
const NUMBERED_STEP = /^(?:[ée]tape\s*\d+|\d+\s*[.)])\s/iu;

function looksLikeIngredient(line: string): boolean {
  return BULLET.test(line) || (/^\d|^[½¼¾⅓]/u.test(line) && !NUMBERED_STEP.test(line));
}

export function parseRecipeText(text: string): ImportedRecipe {
  const recipe: ImportedRecipe = {
    title: null,
    yieldQuantity: null,
    prepMinutes: null,
    cookMinutes: null,
    restMinutes: null,
    sourceUrl: null,
    ingredients: [],
    steps: [],
  };
  let section: "auto" | "ingredients" | "steps" = "auto";
  const lines = (text || "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => normalizeLine(line))
    .filter((line) => line && !SEPARATOR.test(line));

  for (const line of lines) {
    if (INGREDIENTS_HEADER.test(line)) {
      section = "ingredients";
      continue;
    }
    if (STEPS_HEADER.test(line)) {
      section = "steps";
      continue;
    }
    const servings = SERVINGS.map((regex) => regex.exec(line)).find(Boolean);
    if (servings?.[1] && recipe.yieldQuantity === null) {
      recipe.yieldQuantity = Number(servings[1]);
      continue;
    }
    const time = TIME.exec(line);
    const minutes = time?.[2] ? parseTextDuration(time[2]) : null;
    if (time?.[1] && minutes !== null) {
      const kind = time[1].toLowerCase();
      if (kind.startsWith("cuisson")) recipe.cookMinutes = minutes;
      else if (kind.startsWith("repos")) recipe.restMinutes = minutes;
      else if (kind.startsWith("temps")) recipe.prepMinutes ??= minutes;
      else recipe.prepMinutes = minutes;
      continue;
    }
    const empty = recipe.ingredients.length === 0 && recipe.steps.length === 0;
    if (recipe.title === null && section === "auto" && empty && !looksLikeIngredient(line)) {
      recipe.title = line;
      continue;
    }
    const isIngredient =
      section === "ingredients" || (section === "auto" && looksLikeIngredient(line));
    if (isIngredient) recipe.ingredients.push(parseIngredientLine(line));
    else recipe.steps.push(line.replace(BULLET, ""));
  }
  return finish(recipe);
}
