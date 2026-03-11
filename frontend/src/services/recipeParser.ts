// Service de parsing de recettes depuis du texte brut
// Pas de dependances externes, fonctions pures uniquement

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

// Mapping des variantes textuelles vers les abbreviations en DB
const UNIT_MAP: Record<string, string> = {
  g: "g",
  gr: "g",
  gramme: "g",
  grammes: "g",
  kg: "kg",
  kilo: "kg",
  kilos: "kg",
  kilogramme: "kg",
  kilogrammes: "kg",
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
  cas: "cas",
  cs: "cas",
  "c.a.s": "cas",
  "c. a s.": "cas",
  "cuillere a soupe": "cas",
  "cuilleres a soupe": "cas",
  cac: "cac",
  cc: "cac",
  "c.a.c": "cac",
  "c. a c.": "cac",
  "cuillere a cafe": "cac",
  "cuilleres a cafe": "cac",
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

// Unites reconnues par regex (sans espaces, multi-mots exclus)
// Ordre : plus longs d'abord pour eviter les matches partiels (ex: "litres" avant "l")
const SHORT_UNITS =
  "kilogrammes|kilogramme|millilitres|millilitre|centilitres|centilitre|decilitres|decilitre|grammes|gramme|gousses|gousse|tranches|tranche|feuilles|feuille|pincees|pincee|pieces|piece|bottes|botte|litres|litre|brins|brin|kilos|kilo|kg|gr|ml|cl|dl|cas|cac|cs|cc|g|l";

// Unites longues (multi-mots) reconnues avant les unites courtes
const LONG_UNIT_PATTERNS: { pattern: RegExp; abbr: string }[] = [
  { pattern: /cuill[eè]res?\s+[aà]\s+soupe/i, abbr: "cas" },
  { pattern: /cuill[eè]res?\s+[aà]\s+caf[eé]/i, abbr: "cac" },
  { pattern: /c\.\s*a\s+s\./i, abbr: "cas" },
  { pattern: /c\.\s*a\s+c\./i, abbr: "cac" },
  { pattern: /c\.a\.s/i, abbr: "cas" },
  { pattern: /c\.a\.c/i, abbr: "cac" },
];

// Headers de section (ne comptent pas comme titre)
const SECTION_HEADERS =
  /^(ingr[eé]dients?|pr[eé]paration|[eé]tapes?|instructions?|recette|pour|temps|description|directions?|method|proc[eé]d[eé]|process)s?\s*:?\s*$/i;

// Headers de section ingredients
const INGREDIENT_HEADER = /^ingr[eé]dients?\s*:?\s*$/i;

// Headers de section etapes
const STEP_HEADER =
  /^(pr[eé]paration|[eé]tapes?|instructions?|directions?|method|proc[eé]d[eé]|process)\s*:?\s*$/i;

// Ligne de separateur visuel
const SEPARATOR_LINE = /^[\-=_*~]{3,}\s*$/;

// Pattern "a gout" / "selon besoin"
const QUALITATIVE_SUFFIX = /[\s,]*(?:[àa]\s*go[uû]t|selon\s*(?:besoin|envie|go[uû]t))\s*$/i;

// Fractions Unicode → fractions ASCII
const UNICODE_FRACTIONS: Record<string, string> = {
  "½": "1/2",
  "⅓": "1/3",
  "⅔": "2/3",
  "¼": "1/4",
  "¾": "3/4",
  "⅕": "1/5",
  "⅖": "2/5",
  "⅗": "3/5",
  "⅘": "4/5",
  "⅙": "1/6",
  "⅚": "5/6",
  "⅛": "1/8",
  "⅜": "3/8",
  "⅝": "5/8",
  "⅞": "7/8",
};

function normalizeUnicodeFractions(text: string): string {
  return text.replace(/[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/g, (ch) => UNICODE_FRACTIONS[ch] ?? ch);
}

/**
 * Nettoie le texte brut : normalise les sauts de ligne, fractions unicode, supprime separateurs et lignes vides en debut/fin
 */
function cleanText(text: string): string[] {
  const normalized = normalizeUnicodeFractions(text.replace(/\r\n/g, "\n").replace(/\r/g, "\n"));
  const lines = normalized.split("\n");

  // Supprimer les separateurs visuels
  const filtered = lines.filter((line) => !SEPARATOR_LINE.test(line));

  // Trim les lignes vides en debut/fin
  let start = 0;
  while (start < filtered.length && filtered[start].trim() === "") start++;
  let end = filtered.length - 1;
  while (end > start && filtered[end].trim() === "") end--;

  return filtered.slice(start, end + 1);
}

/**
 * Detecte le titre : premiere ligne non vide < 100 caracteres qui n'est pas un header de section
 */
function detectTitle(lines: string[]): { title: string | null; titleIndex: number } {
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === "") continue;
    if (trimmed.length < 100 && !SECTION_HEADERS.test(trimmed)) {
      return { title: trimmed, titleIndex: i };
    }
    // Si la premiere ligne non vide est un header, pas de titre
    return { title: null, titleIndex: -1 };
  }
  return { title: null, titleIndex: -1 };
}

/**
 * Convertit une fraction (ex: "1/2") en nombre
 */
function parseFraction(str: string): number {
  const parts = str.split("/");
  if (parts.length === 2) {
    const num = parseFloat(parts[0]);
    const den = parseFloat(parts[1]);
    if (!isNaN(num) && !isNaN(den) && den !== 0) {
      return num / den;
    }
  }
  return NaN;
}

/**
 * Parse une quantite (entier, decimal, fraction)
 */
function parseQuantity(str: string): number | null {
  const trimmed = str.trim().replace(",", ".");
  if (trimmed.includes("/")) {
    const val = parseFraction(trimmed);
    return isNaN(val) ? null : val;
  }
  const val = parseFloat(trimmed);
  return isNaN(val) ? null : val;
}

/**
 * Resout l'abbreviation DB a partir d'un texte d'unite
 */
function resolveUnit(unitText: string): string | null {
  const lower = unitText.toLowerCase().trim();
  if (UNIT_MAP[lower]) return UNIT_MAP[lower];
  return null;
}

/**
 * Supprime les puces en debut de ligne
 */
function stripBullet(line: string): string {
  return line.replace(/^\s*[-*•–—]\s*/, "");
}

/**
 * Supprime la numerotation en debut de ligne d'etape
 */
function stripStepNumbering(line: string): string {
  return line
    .replace(/^\s*[eéEÉ]tape\s+\d+\s*[:\-–—]?\s*/i, "")
    .replace(/^\s*\d+\s*[.):\-–—]\s*/, "")
    .replace(/^\s*[-*•–—]\s*/, "");
}

/**
 * Parse une ligne d'ingredient et retourne un ParsedIngredient
 */
function parseIngredientLine(rawLine: string): ParsedIngredient {
  const line = stripBullet(rawLine).trim();
  const result: ParsedIngredient = {
    raw: line,
    quantity: null,
    unitAbbreviation: null,
    name: null,
  };

  if (!line) return result;

  // Pattern "a gout" / "selon besoin"
  const qualMatch = line.match(QUALITATIVE_SUFFIX);
  if (qualMatch) {
    const qualText = qualMatch[0]
      .trim()
      .replace(/^[\s,]+/, "")
      .toLowerCase();
    const namepart = line.slice(0, qualMatch.index).trim();
    result.name = namepart || null;

    if (/selon\s*(besoin|envie)/i.test(qualText)) {
      result.unitAbbreviation = "selon besoin";
    } else {
      result.unitAbbreviation = "a gout";
    }
    return result;
  }

  // Tenter les unites longues (multi-mots) en premier
  for (const { pattern, abbr } of LONG_UNIT_PATTERNS) {
    // Pattern : quantite + unite longue + (de/d') + nom
    const longRegex = new RegExp(
      `^(\\d+[.,]?\\d*|\\d+\\/\\d+)\\s+${pattern.source}\\s+(?:de\\s+|d')?(.+)$`,
      "i"
    );
    const m = line.match(longRegex);
    if (m) {
      result.quantity = parseQuantity(m[1]);
      result.unitAbbreviation = abbr;
      result.name = m[2].trim();
      return result;
    }
  }

  // Pattern principal : quantite collee ou separee de l'unite courte
  // Fraction en premier pour eviter que "1/2" matche juste "1"
  const mainRegex = new RegExp(
    `^(\\d+\\/\\d+|\\d+[.,]?\\d*)\\s*(${SHORT_UNITS})?\\s*(?:de\\s+|d')?(.+)$`,
    "i"
  );
  const mainMatch = line.match(mainRegex);
  if (mainMatch) {
    result.quantity = parseQuantity(mainMatch[1]);
    if (mainMatch[2]) {
      result.unitAbbreviation = resolveUnit(mainMatch[2]);
    }
    result.name = mainMatch[3].trim();
    return result;
  }

  // Fallback : pas de match, le nom est la ligne entiere
  result.name = line;
  return result;
}

/**
 * Detecte si une ligne ressemble a un ingredient (commence par un nombre ou une puce suivie d'un nombre)
 */
function looksLikeIngredient(line: string): boolean {
  const stripped = stripBullet(line).trim();
  return /^\d/.test(stripped);
}

/**
 * Detecte si une ligne ressemble a une etape numerotee
 */
function looksLikeNumberedStep(line: string): boolean {
  return /^\s*\d+\s*[.):\-–—]/.test(line) || /^\s*[eéEÉ]tape\s+\d+/i.test(line);
}

/**
 * Parse une duree en minutes depuis un texte (ex: "1h30", "45 min", "2 heures")
 */
function parseDuration(text: string): number | null {
  // Format "Xh" ou "XhY" ou "X heures Y"
  const hourMatch = text.match(/(\d+)\s*h(?:eures?)?\s*(\d+)?/i);
  if (hourMatch) {
    const hours = parseInt(hourMatch[1], 10);
    const mins = hourMatch[2] ? parseInt(hourMatch[2], 10) : 0;
    return hours * 60 + mins;
  }

  // Format "X min" ou "X minutes"
  const minMatch = text.match(/(\d+)\s*min(?:utes?)?/i);
  if (minMatch) {
    return parseInt(minMatch[1], 10);
  }

  return null;
}

/**
 * Extrait les metadonnees (servings, temps) en scannant toutes les lignes
 */
function extractMetadata(lines: string[]): {
  servings: number | null;
  prepTime: number | null;
  cookTime: number | null;
  restTime: number | null;
} {
  let servings: number | null = null;
  let prepTime: number | null = null;
  let cookTime: number | null = null;
  let restTime: number | null = null;
  let genericTime: number | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Servings
    if (servings === null) {
      const servingsMatch = trimmed.match(
        /(\d+)\s*(?:personnes?|pers\.?|parts?|portions?|servings?)/i
      );
      if (servingsMatch) {
        servings = parseInt(servingsMatch[1], 10);
      }
    }

    // Prep time
    if (prepTime === null) {
      const prepMatch = trimmed.match(/pr[eé]p(?:aration)?\s*:?\s*(.*)/i);
      if (prepMatch) {
        prepTime = parseDuration(prepMatch[1]);
      }
    }

    // Cook time
    if (cookTime === null) {
      const cookMatch = trimmed.match(/cu(?:isson|ire)\s*:?\s*(.*)/i);
      if (cookMatch) {
        cookTime = parseDuration(cookMatch[1]);
      }
    }

    // Rest time
    if (restTime === null) {
      const restMatch = trimmed.match(/(?:repos?|pause)\s*:?\s*(.*)/i);
      if (restMatch) {
        restTime = parseDuration(restMatch[1]);
      }
    }

    // Temps generique (fallback pour prepTime)
    if (genericTime === null) {
      const timeMatch = trimmed.match(/temps\s*:?\s*(.*)/i);
      if (timeMatch) {
        genericTime = parseDuration(timeMatch[1]);
      }
    }
  }

  // Fallback : temps generique → prepTime
  if (prepTime === null && genericTime !== null) {
    prepTime = genericTime;
  }

  return { servings, prepTime, cookTime, restTime };
}

/**
 * Parse un texte de recette brut et retourne un objet ParsedRecipe
 */
export function parseRecipeText(text: string): ParsedRecipe {
  const empty: ParsedRecipe = {
    title: null,
    servings: null,
    prepTime: null,
    cookTime: null,
    restTime: null,
    ingredients: [],
    steps: [],
  };

  if (!text || !text.trim()) return empty;

  const lines = cleanText(text);
  if (lines.length === 0) return empty;

  // Detecter le titre
  const { title, titleIndex } = detectTitle(lines);

  // Extraire les metadonnees
  const metadata = extractMetadata(lines);

  // Scanner les sections
  let currentSection: "NONE" | "INGREDIENTS" | "STEPS" = "NONE";
  const ingredientLines: string[] = [];
  const stepLines: string[] = [];
  let hasHeaders = false;

  for (let i = 0; i < lines.length; i++) {
    if (i === titleIndex) continue;

    const trimmed = lines[i].trim();
    if (trimmed === "") continue;

    // Detecter un header de section
    if (INGREDIENT_HEADER.test(trimmed)) {
      currentSection = "INGREDIENTS";
      hasHeaders = true;
      continue;
    }
    if (STEP_HEADER.test(trimmed)) {
      currentSection = "STEPS";
      hasHeaders = true;
      continue;
    }

    // Ignorer les lignes de metadata (servings, temps) dans toutes les sections
    const isMetaLine =
      /(\d+)\s*(?:personnes?|pers\.?|parts?|portions?|servings?)/i.test(trimmed) ||
      /pr[eé]p(?:aration)?\s*:/i.test(trimmed) ||
      /cu(?:isson|ire)\s*:/i.test(trimmed) ||
      /(?:repos?|pause)\s*:/i.test(trimmed) ||
      /temps\s*:/i.test(trimmed) ||
      /^pour\s+\d+/i.test(trimmed);
    if (isMetaLine) continue;

    if (currentSection === "INGREDIENTS") {
      ingredientLines.push(trimmed);
    } else if (currentSection === "STEPS") {
      stepLines.push(trimmed);
    } else if (currentSection === "NONE") {
      // Pas encore dans une section reconnue : capturer les lignes qui ressemblent a des ingredients
      // (commence par un nombre ou une puce suivie d'un nombre)
      if (looksLikeIngredient(trimmed)) {
        ingredientLines.push(trimmed);
      }
    }
  }

  // Fallback : si aucun header detecte, classifier les lignes par heuristique
  if (!hasHeaders) {
    for (let i = 0; i < lines.length; i++) {
      if (i === titleIndex) continue;
      const trimmed = lines[i].trim();
      if (trimmed === "") continue;

      // Ignorer les lignes de metadata
      const isMetaLine =
        /(\d+)\s*(?:personnes?|pers\.?|parts?|portions?|servings?)/i.test(trimmed) ||
        /pr[eé]p(?:aration)?\s*:/i.test(trimmed) ||
        /cu(?:isson|ire)\s*:/i.test(trimmed) ||
        /(?:repos?|pause)\s*:/i.test(trimmed) ||
        /temps\s*:/i.test(trimmed) ||
        /^pour\s+\d+/i.test(trimmed);
      if (isMetaLine) continue;

      if (looksLikeNumberedStep(trimmed)) {
        stepLines.push(trimmed);
      } else if (looksLikeIngredient(trimmed)) {
        ingredientLines.push(trimmed);
      } else {
        // Les lignes restantes non classifiees → etapes
        stepLines.push(trimmed);
      }
    }
  }

  // Parser les ingredients
  const ingredients = ingredientLines.map(parseIngredientLine);

  // Parser les etapes
  const steps = stepLines
    .map((line) => stripStepNumbering(line).trim())
    .filter((line) => line.length > 0);

  return {
    title,
    ...metadata,
    ingredients,
    steps,
  };
}
