// Seed des referentiels [D160] : idempotent, creation seulement. Une ligne deja
// presente n'est jamais reecrite : elle appartient ensuite au super admin (C4).
import { normalizeName } from "@fm/shared";

import type { Db } from "../core/db/client.ts";

type UnitSeed = {
  code: string;
  dimension: "MASS" | "VOLUME" | "COUNT" | "NONE";
  toBase: number | null;
  metric?: boolean;
  name: string;
  namePlural?: string;
  abbreviation: string;
};

/** Unites usuelles en francais (les cuilleres sont des volumes, D46). */
const UNITS: UnitSeed[] = [
  {
    code: "g",
    dimension: "MASS",
    toBase: 1,
    metric: true,
    name: "gramme",
    namePlural: "grammes",
    abbreviation: "g",
  },
  {
    code: "kg",
    dimension: "MASS",
    toBase: 1000,
    metric: true,
    name: "kilogramme",
    namePlural: "kilogrammes",
    abbreviation: "kg",
  },
  {
    code: "ml",
    dimension: "VOLUME",
    toBase: 1,
    metric: true,
    name: "millilitre",
    namePlural: "millilitres",
    abbreviation: "ml",
  },
  {
    code: "cl",
    dimension: "VOLUME",
    toBase: 10,
    metric: true,
    name: "centilitre",
    namePlural: "centilitres",
    abbreviation: "cl",
  },
  {
    code: "l",
    dimension: "VOLUME",
    toBase: 1000,
    metric: true,
    name: "litre",
    namePlural: "litres",
    abbreviation: "l",
  },
  {
    code: "tsp",
    dimension: "VOLUME",
    toBase: 5,
    name: "cuillère à café",
    namePlural: "cuillères à café",
    abbreviation: "c. à café",
  },
  {
    code: "tbsp",
    dimension: "VOLUME",
    toBase: 15,
    name: "cuillère à soupe",
    namePlural: "cuillères à soupe",
    abbreviation: "c. à soupe",
  },
  {
    code: "cup",
    dimension: "VOLUME",
    toBase: 250,
    name: "tasse",
    namePlural: "tasses",
    abbreviation: "tasse",
  },
  {
    code: "piece",
    dimension: "COUNT",
    toBase: null,
    name: "pièce",
    namePlural: "pièces",
    abbreviation: "pièce",
  },
  {
    code: "slice",
    dimension: "COUNT",
    toBase: null,
    name: "tranche",
    namePlural: "tranches",
    abbreviation: "tranche",
  },
  {
    code: "clove",
    dimension: "COUNT",
    toBase: null,
    name: "gousse",
    namePlural: "gousses",
    abbreviation: "gousse",
  },
  {
    code: "bunch",
    dimension: "COUNT",
    toBase: null,
    name: "botte",
    namePlural: "bottes",
    abbreviation: "botte",
  },
  {
    code: "can",
    dimension: "COUNT",
    toBase: null,
    name: "boîte",
    namePlural: "boîtes",
    abbreviation: "boîte",
  },
  {
    code: "sachet",
    dimension: "COUNT",
    toBase: null,
    name: "sachet",
    namePlural: "sachets",
    abbreviation: "sachet",
  },
  {
    code: "pinch",
    dimension: "NONE",
    toBase: null,
    name: "pincée",
    namePlural: "pincées",
    abbreviation: "pincée",
  },
  { code: "to-taste", dimension: "NONE", toBase: null, name: "à goût", abbreviation: "à goût" },
];

/** Rayons dans l'ordre d'un parcours en magasin ; sans rayon : "Autres" (D125). */
const AISLES: [string, string][] = [
  ["fruits-vegetables", "Fruits et légumes"],
  ["bakery", "Boulangerie"],
  ["butcher", "Boucherie"],
  ["fishmonger", "Poissonnerie"],
  ["dairy", "Crèmerie"],
  ["savory-grocery", "Épicerie salée"],
  ["sweet-grocery", "Épicerie sucrée"],
  ["canned", "Conserves"],
  ["frozen", "Surgelés"],
  ["drinks", "Boissons"],
];

/** Tags globaux : liste courte (F-REF-1). */
const GLOBAL_TAGS = [
  "Végétarien",
  "Végan",
  "Sans gluten",
  "Rapide",
  "Entrée",
  "Plat",
  "Dessert",
  "Apéritif",
  "Petit-déjeuner",
  "Batch cooking",
];

export async function seedReferentials(db: Db): Promise<void> {
  for (const [index, unit] of UNITS.entries()) {
    await db.unit.upsert({
      where: { code: unit.code },
      update: {},
      create: {
        code: unit.code,
        dimension: unit.dimension,
        toBase: unit.toBase,
        metric: unit.metric ?? false,
        sortOrder: index,
        translations: {
          create: {
            locale: "fr",
            name: unit.name,
            namePlural: unit.namePlural ?? null,
            abbreviation: unit.abbreviation,
          },
        },
      },
    });
  }
  for (const [index, [code, name]] of AISLES.entries()) {
    await db.aisle.upsert({
      where: { code },
      update: {},
      create: { code, sortOrder: index, translations: { create: { locale: "fr", name } } },
    });
  }
  for (const name of GLOBAL_TAGS) {
    const slug = normalizeName(name).replace(/ /g, "-");
    const existing = await db.tag.findFirst({ where: { scope: "GLOBAL", slug } });
    if (existing) continue;
    await db.tag.create({
      data: { scope: "GLOBAL", name, slug, translations: { create: { locale: "fr", name } } },
    });
  }
}
