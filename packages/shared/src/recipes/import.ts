// Import de recettes (C3.8) : logique pure partagee par l'API (pages web,
// JSON-LD schema.org/Recipe) et le front (texte colle). Le resultat ouvre
// l'editeur pre-rempli : rien n'est enregistre sans relecture.
import {
  RECIPE_INGREDIENT_NOTE_MAX,
  RECIPE_LINES_MAX,
  RECIPE_STEP_MAX,
  RECIPE_TITLE_MAX,
  RECIPE_URL_MAX,
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
  /** Photo de la page, lien http(s) ; null pour un texte colle. */
  imageUrl: string | null;
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

// "(facultatif)", "(optionnel)" : passe en note, visible et modifiable dans l'editeur.
const OPTIONAL_MARK = /\s*\((facultati(?:f|ve)|optionnel(?:le)?|en option)\)/iu;

export function parseIngredientLine(line: string): ImportedIngredient {
  const raw = normalizeLine(cleanText(line)).replace(BULLET, "");
  const optional = OPTIONAL_MARK.exec(raw);
  if (!optional?.[1]) return parseIngredientText(raw, raw);
  const parsed = parseIngredientText(raw.replace(OPTIONAL_MARK, "").trim(), raw);
  const word = optional[1].toLowerCase();
  const note = clip(parsed.note ? `${parsed.note}, ${word}` : word, RECIPE_INGREDIENT_NOTE_MAX);
  return { ...parsed, note };
}

function parseIngredientText(text: string, raw: string): ImportedIngredient {
  const base = { raw, quantity: null, unitCode: null, note: null };

  const taste = TASTE_PREFIX.exec(text) ?? TASTE_SUFFIX.exec(text);
  if (taste?.[1]) {
    return { ...base, unitCode: "to-taste", ...splitNote(taste[1]), check: false };
  }

  const quantity = QUANTITY.exec(text);
  if (!quantity?.[1]) {
    const { name, note } = splitNote(text);
    return { ...base, name: name || text, note, check: true };
  }
  const range = /[-–à]/u.test(quantity[0].slice(quantity[1].length));
  let value = toNumber(quantity[1]);
  let rest = text.slice(quantity[0].length);
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
    name: name || text,
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

// "sel, poivre", "sel et poivre noir" : sans quantite, une liste d'assaisonnements
// donne une ligne "a gout" par assaisonnement (D4). Ailleurs, la virgule garde son
// sens de precision ("oignon, emince").
const SEASONING =
  /^(?:sel(?: fin)?|gros sel|fleur de sel|poivre(?: noir| blanc| du moulin)?|noix de muscade|muscade|piment d['’]espelette|paprika|cumin|herbes de provence)$/iu;

function splitSeasonings(ingredient: ImportedIngredient): ImportedIngredient[] {
  if (ingredient.quantity !== null) return [ingredient];
  const text = ingredient.note ? `${ingredient.name}, ${ingredient.note}` : ingredient.name;
  const parts = text.split(/\s*,\s*|\s+et\s+/u).filter(Boolean);
  if (parts.length < 2 || !parts.every((part) => SEASONING.test(part))) return [ingredient];
  return parts.map((name) => ({
    raw: ingredient.raw,
    quantity: null,
    unitCode: "to-taste",
    name,
    note: null,
    check: false,
  }));
}

// Formules de fin sans geste ("C'est pret !", "Deguster.") : pas des etapes (D13).
const FILLER_STEP =
  /^(?:c['’]est\s+pr[eê]ts?|d[ée]gust(?:er|ez)|bon\s+app[ée]tit|(?:et\s+)?voil[aà])\s*[!.…]*$/iu;

/**
 * Etapes coupees au milieu d'une phrase par la page ("Etaler la pate dans un
 * moule," puis "la piquer...") : recousues (D13).
 */
function joinBrokenSteps(steps: readonly string[]): string[] {
  const joined: string[] = [];
  for (const step of steps) {
    const previous = joined.at(-1);
    if (previous !== undefined && (/[,;:]$/u.test(previous) || /^\p{Ll}/u.test(step))) {
      joined[joined.length - 1] = `${previous} ${step}`;
    } else {
      joined.push(step);
    }
  }
  return joined;
}

// Suffixes publicitaires des titres ("Quiche lorraine : la meilleure recette").
const TITLE_SUFFIX =
  /\s*[:|–—-]\s*(?:la\s+)?(?:meilleure\s+recette|recette\s+(?:facile|rapide|inratable|traditionnelle|originale|maison|de\s+grand-m[eè]re))\b.*$/iu;

function cleanTitle(title: string): string {
  return title.replace(TITLE_SUFFIX, "").trim() || title;
}

const stripStepNumber = (step: string) =>
  step.replace(/^(?:[ée]tape\s*\d+\s*[:.)-]?|\d+\s*[.)])\s*/iu, "").trim();

function finish(recipe: ImportedRecipe): ImportedRecipe {
  return {
    ...recipe,
    title: recipe.title ? clip(cleanTitle(recipe.title), RECIPE_TITLE_MAX) : null,
    ingredients: recipe.ingredients
      .filter((i) => i.name)
      .flatMap(splitSeasonings)
      .slice(0, RECIPE_LINES_MAX),
    steps: joinBrokenSteps(
      recipe.steps.map(stripStepNumber).filter((step) => step && !FILLER_STEP.test(step))
    )
      .map((step) => clip(step, RECIPE_STEP_MAX))
      .slice(0, RECIPE_LINES_MAX),
  };
}

/** Premiere photo http(s) : lien, tableau, ImageObject ({ url }). */
function imageOf(value: unknown, depth = 0): string | null {
  if (depth > 3 || !value) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = imageOf(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof value === "object") return imageOf((value as Record<string, unknown>).url, depth + 1);
  const url = textOf(value).trim();
  return /^https?:\/\/\S+$/i.test(url) && url.length <= RECIPE_URL_MAX ? url : null;
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
    imageUrl: imageOf(data.image),
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
  /^(?:pr[ée]paration|[ée]tapes?|instructions?|recette|m[ée]thode|d[ée]roul[ée](?:ment)?|process|proc[ée]d[ée])\s*:?$/iu;
// "ETAPE 1" seul sur sa ligne : ouvre une etape faite des lignes qui suivent.
const STEP_HEADING = /^[ée]tape\s*\d+\s*[:.)-]?$/iu;
// Intertitre d'ingredients sans quantite ("Pour servir :") : pas un ingredient.
const INGREDIENT_SUBHEADER = /^[^\d].*:$/u;
// Ligne date/heure d'un copier-coller de messagerie ("— 03/04/2026 12:23").
const DATE_LINE = /^[-–—\s]*\d{1,2}\/\d{1,2}\/\d{2,4}(?:\s+(?:[aà]\s+)?\d{1,2}[:h]\d{2})?$/u;
const SERVINGS = [
  /^(?:pour\s+)?(\d+)\s*(?:personnes?|pers\.?|parts?|portions?|couverts?)\b/iu,
  /^(?:portions?|parts?|personnes?|nombre de personnes)\s*:?\s*(\d+)/iu,
];
const TIME_KIND = "pr[ée]paration|cuisson|repos|temps(?:\\s+total)?";
const TIME_VALUE =
  "\\d+\\s*h(?:eures?)?(?:\\s*\\d+\\s*(?:min(?:utes?)?)?)?|\\d+\\s*min(?:utes?|\\.)?";
// Une ou plusieurs durees sur la ligne ("Preparation : 20 min - Cuisson : 1 h 15", D5).
const TIME_ITEM = new RegExp(`(${TIME_KIND})\\s*:?\\s*(${TIME_VALUE})`, "giu");
const TIME_LINE = new RegExp(
  `^(?:(?:${TIME_KIND})\\s*:?\\s*(?:${TIME_VALUE}))(?:\\s*[-–—|/,;•·]?\\s*(?:${TIME_KIND})\\s*:?\\s*(?:${TIME_VALUE}))*\\s*$`,
  "iu"
);
// Duree sans valeur ("Repos: --", "Cuisson : aucun") : ignoree.
const EMPTY_TIME = new RegExp(
  `^(?:${TIME_KIND})\\s*(?::\\s*(?:[-–—]+|aucun|n[ée]ant|0\\s*min(?:utes?)?)|[-–—]{2,})$`,
  "iu"
);
const NUMBERED_STEP = /^(?:[ée]tape\s*\d+|\d+\s*[.)])\s/iu;

function looksLikeIngredient(line: string): boolean {
  return BULLET.test(line) || (/^\d|^[½¼¾⅓]/u.test(line) && !NUMBERED_STEP.test(line));
}

/** "sel, poivre" : courte, sans ponctuation finale (une etape est une phrase). */
function looksLikeBareIngredient(line: string): boolean {
  return !/[.!?:;]$/u.test(line) && line.split(/\s+/u).length <= 4;
}

export function parseRecipeText(text: string): ImportedRecipe {
  const recipe: ImportedRecipe = {
    title: null,
    yieldQuantity: null,
    prepMinutes: null,
    cookMinutes: null,
    restMinutes: null,
    sourceUrl: null,
    imageUrl: null,
    ingredients: [],
    steps: [],
  };
  let section: "auto" | "ingredients" | "steps" = "auto";
  // Etapes en blocs "ETAPE N" : la ligne suivante complete l'etape ouverte.
  let blocks = false;
  let stepOpen = false;
  const lines = (text || "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => normalizeLine(line))
    .filter((line) => line && !SEPARATOR.test(line) && !DATE_LINE.test(line));

  for (const line of lines) {
    if (INGREDIENTS_HEADER.test(line)) {
      section = "ingredients";
      continue;
    }
    if (STEPS_HEADER.test(line)) {
      section = "steps";
      continue;
    }
    if (STEP_HEADING.test(line)) {
      section = "steps";
      blocks = true;
      stepOpen = false;
      continue;
    }
    if (EMPTY_TIME.test(line)) continue;
    const servings = SERVINGS.map((regex) => regex.exec(line)).find(Boolean);
    if (servings?.[1] && recipe.yieldQuantity === null) {
      recipe.yieldQuantity = Number(servings[1]);
      continue;
    }
    if (TIME_LINE.test(line)) {
      for (const [, kindText = "", value = ""] of line.matchAll(TIME_ITEM)) {
        const minutes = parseTextDuration(value);
        if (minutes === null) continue;
        const kind = kindText.toLowerCase();
        if (kind.startsWith("cuisson")) recipe.cookMinutes = minutes;
        else if (kind.startsWith("repos")) recipe.restMinutes = minutes;
        else if (kind.startsWith("temps")) recipe.prepMinutes ??= minutes;
        else recipe.prepMinutes = minutes;
      }
      continue;
    }
    const empty = recipe.ingredients.length === 0 && recipe.steps.length === 0;
    if (recipe.title === null && section === "auto" && empty && !looksLikeIngredient(line)) {
      recipe.title = line;
      continue;
    }
    // Sans section : une ligne courte qui suit des ingredients, avant toute etape
    // ("sel, poivre") ; sans quantite, sa virgule separe une liste, pas une note.
    const inIngredientList = recipe.ingredients.length > 0 && recipe.steps.length === 0;
    const bare =
      section === "auto" &&
      !looksLikeIngredient(line) &&
      inIngredientList &&
      looksLikeBareIngredient(line);
    const isIngredient =
      section === "ingredients" || (section === "auto" && looksLikeIngredient(line));
    if (isIngredient && !BULLET.test(line) && INGREDIENT_SUBHEADER.test(line)) continue;
    if (bare) recipe.ingredients.push({ ...parseIngredientLine(line), name: line, note: null });
    else if (isIngredient) recipe.ingredients.push(parseIngredientLine(line));
    else if (blocks && stepOpen) {
      recipe.steps[recipe.steps.length - 1] =
        `${recipe.steps.at(-1) ?? ""} ${line.replace(BULLET, "")}`;
    } else {
      recipe.steps.push(line.replace(BULLET, ""));
      stepOpen = blocks;
    }
  }
  return finish(recipe);
}
