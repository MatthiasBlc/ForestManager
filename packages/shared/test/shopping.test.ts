import { describe, expect, it } from "vitest";

import {
  addParts,
  aggregatePlanLines,
  mergeIntoList,
  productKey,
  resolveSectionId,
  type PlanIngredientLine,
  type ShoppingPart,
  type ShoppingUnit,
} from "../src/shopping/index.ts";
import {
  applyPlanBodySchema,
  createShoppingItemBodySchema,
  planPreviewBodySchema,
  sectionOrderBodySchema,
  shoppingItemOrderBodySchema,
  updateShoppingItemBodySchema,
} from "../src/schemas/shopping.ts";

const G = "00000000-0000-4000-8000-000000000001";
const KG = "00000000-0000-4000-8000-000000000002";
const ML = "00000000-0000-4000-8000-000000000003";
const PIECE = "00000000-0000-4000-8000-000000000004";
const CLOVE = "00000000-0000-4000-8000-000000000005";
const units: ShoppingUnit[] = [
  { id: G, code: "g", dimension: "MASS", toBase: 1, metric: true },
  { id: KG, code: "kg", dimension: "MASS", toBase: 1000, metric: true },
  { id: ML, code: "ml", dimension: "VOLUME", toBase: 1, metric: true },
  { id: PIECE, code: "piece", dimension: "COUNT", toBase: null, metric: false },
  { id: CLOVE, code: "clove", dimension: "COUNT", toBase: null, metric: false },
];

const ONION = "00000000-0000-4000-8000-0000000000a1";
const PEPPER = "00000000-0000-4000-8000-0000000000a2";
const SALT = "00000000-0000-4000-8000-0000000000a3";

describe("productKey", () => {
  it("cle par ingredient, ou par nom normalise pour un texte libre", () => {
    expect(productKey({ ingredientId: ONION, label: null })).toBe(`ingredient:${ONION}`);
    expect(productKey({ ingredientId: null, label: "  Éponge  " })).toBe("label:eponge");
    expect(productKey({ ingredientId: null, label: "eponge" })).toBe("label:eponge");
  });
});

describe("addParts", () => {
  it("additionne masses et pieces converties par le poids par unite", () => {
    const parts: ShoppingPart[] = [
      { quantity: 500, unitId: G },
      { quantity: 1, unitId: KG },
      { quantity: 3, unitId: PIECE },
    ];
    expect(addParts(parts, units, { [PIECE]: 100 })).toEqual([{ quantity: 1.8, unitId: KG }]);
  });

  it("joint les parts non convertibles, dans l'ordre masse, volume, autres", () => {
    const parts: ShoppingPart[] = [
      { quantity: 3, unitId: PIECE },
      { quantity: 500, unitId: G },
      { quantity: 2, unitId: PIECE },
      { quantity: 1, unitId: null },
    ];
    expect(addParts(parts, units)).toEqual([
      { quantity: 500, unitId: G },
      { quantity: 5, unitId: PIECE },
      { quantity: 1, unitId: null },
    ]);
  });

  it("ecarte les parts sans quantite (a gout)", () => {
    expect(addParts([{ quantity: null, unitId: null }], units)).toEqual([]);
    expect(
      addParts(
        [
          { quantity: null, unitId: G },
          { quantity: 200, unitId: G },
        ],
        units
      )
    ).toEqual([{ quantity: 200, unitId: G }]);
  });

  it("garde une unite inconnue a part", () => {
    const unknown = "00000000-0000-4000-8000-0000000000ff";
    expect(
      addParts(
        [
          { quantity: 1, unitId: unknown },
          { quantity: 2, unitId: unknown },
        ],
        units
      )
    ).toEqual([{ quantity: 3, unitId: unknown }]);
  });
});

function line(overrides: Partial<PlanIngredientLine>): PlanIngredientLine {
  return {
    ingredientId: ONION,
    quantity: 1,
    unitId: PIECE,
    optional: false,
    source: {
      mealSlotId: "00000000-0000-4000-8000-0000000000b1",
      recipeId: "00000000-0000-4000-8000-0000000000c1",
      recipeTitle: "Curry",
      date: "2026-11-24",
      mealTime: "DINNER",
    },
    ...overrides,
  };
}

const QUICHE = {
  mealSlotId: "00000000-0000-4000-8000-0000000000b2",
  recipeId: "00000000-0000-4000-8000-0000000000c2",
  recipeTitle: "Quiche",
  date: "2026-11-25",
  mealTime: "LUNCH" as const,
};

describe("aggregatePlanLines", () => {
  it("une ligne par ingredient, parts additionnees, detail par recette", () => {
    const result = aggregatePlanLines(
      [
        line({ quantity: 2 }),
        line({ quantity: 300, unitId: G, source: QUICHE }),
        line({ quantity: 1 }),
        line({ ingredientId: SALT, quantity: null, unitId: null }),
      ],
      units
    );
    expect(result).toEqual([
      {
        ingredientId: ONION,
        optional: false,
        parts: [
          { quantity: 300, unitId: G },
          { quantity: 3, unitId: PIECE },
        ],
        sources: [
          { source: line({}).source, parts: [{ quantity: 3, unitId: PIECE }] },
          { source: QUICHE, parts: [{ quantity: 300, unitId: G }] },
        ],
      },
      {
        ingredientId: SALT,
        optional: false,
        parts: [],
        sources: [{ source: line({}).source, parts: [] }],
      },
    ]);
  });

  it("convertit les pieces par le poids de l'ingredient", () => {
    const [onion] = aggregatePlanLines(
      [line({ quantity: 2 }), line({ quantity: 300, unitId: G, source: QUICHE })],
      units,
      { [ONION]: { [PIECE]: 150 } }
    );
    expect(onion?.parts).toEqual([{ quantity: 600, unitId: G }]);
  });

  it("facultatif seulement si toutes ses lignes le sont", () => {
    const result = aggregatePlanLines(
      [
        line({ optional: true }),
        line({ ingredientId: PEPPER, optional: true }),
        line({ ingredientId: PEPPER, optional: false, source: QUICHE }),
      ],
      units
    );
    expect(result.map((r) => [r.ingredientId, r.optional])).toEqual([
      [ONION, true],
      [PEPPER, false],
    ]);
  });
});

describe("resolveSectionId", () => {
  const sections = [
    { id: "s-primeur", aisleId: "a-produce" },
    { id: "s-alimentaire", aisleId: null },
  ];

  it("section favorite d'abord", () => {
    const favorites = new Map([[`ingredient:${PEPPER}`, "s-alimentaire"]]);
    expect(
      resolveSectionId({ key: `ingredient:${PEPPER}`, aisleId: "a-produce" }, favorites, sections)
    ).toBe("s-alimentaire");
  });

  it("sinon la section du rayon, sinon Autres (null)", () => {
    const none = new Map<string, string>();
    expect(resolveSectionId({ key: "k", aisleId: "a-produce" }, none, sections)).toBe("s-primeur");
    expect(resolveSectionId({ key: "k", aisleId: "a-dairy" }, none, sections)).toBeNull();
    expect(resolveSectionId({ key: "label:eponge", aisleId: null }, none, sections)).toBeNull();
  });

  it("ignore une favorite dont la section n'existe plus", () => {
    const favorites = new Map([["k", "s-supprimee"]]);
    expect(resolveSectionId({ key: "k", aisleId: "a-produce" }, favorites, sections)).toBe(
      "s-primeur"
    );
  });
});

describe("mergeIntoList", () => {
  const add = (_key: string, parts: ShoppingPart[]) => addParts(parts, units);
  const pepperKey = `ingredient:${PEPPER}`;

  it("ajoute sur la ligne non cochee du produit dans la meme section", () => {
    const result = mergeIntoList(
      [{ id: "i1", key: pepperKey, sectionId: "s-primeur", checked: false, parts: [] }],
      [
        {
          key: pepperKey,
          sectionId: "s-primeur",
          parts: [{ quantity: 2, unitId: PIECE }],
          payload: "A",
        },
      ],
      add
    );
    expect(result).toEqual({
      updates: [{ id: "i1", parts: [{ quantity: 2, unitId: PIECE }], payloads: ["A"] }],
      creates: [],
    });
  });

  it("une ligne deplacee dans une autre section ou cochee reste a part [D231]", () => {
    const result = mergeIntoList(
      [
        { id: "i1", key: pepperKey, sectionId: "s-alimentaire", checked: false, parts: [] },
        { id: "i2", key: pepperKey, sectionId: "s-primeur", checked: true, parts: [] },
      ],
      [
        {
          key: pepperKey,
          sectionId: "s-primeur",
          parts: [{ quantity: 1, unitId: PIECE }],
          payload: "A",
        },
      ],
      add
    );
    expect(result).toEqual({
      updates: [],
      creates: [
        {
          key: pepperKey,
          sectionId: "s-primeur",
          parts: [{ quantity: 1, unitId: PIECE }],
          payloads: ["A"],
        },
      ],
    });
  });

  it("deux ajouts du meme produit dans la meme section font une seule ligne", () => {
    const result = mergeIntoList(
      [],
      [
        { key: pepperKey, sectionId: null, parts: [{ quantity: 1, unitId: PIECE }], payload: "A" },
        { key: pepperKey, sectionId: null, parts: [{ quantity: 2, unitId: PIECE }], payload: "B" },
      ],
      add
    );
    expect(result.creates).toEqual([
      {
        key: pepperKey,
        sectionId: null,
        parts: [{ quantity: 3, unitId: PIECE }],
        payloads: ["A", "B"],
      },
    ]);
  });
});

describe("schemas", () => {
  it("un article a la main : un ingredient ou un texte, pas les deux", () => {
    expect(createShoppingItemBodySchema.safeParse({ label: " eponge " }).data).toEqual({
      label: "eponge",
      parts: [],
    });
    expect(createShoppingItemBodySchema.safeParse({ ingredientId: ONION }).success).toBe(true);
    expect(createShoppingItemBodySchema.safeParse({}).success).toBe(false);
    expect(
      createShoppingItemBodySchema.safeParse({ ingredientId: ONION, label: "x" }).success
    ).toBe(false);
    expect(
      createShoppingItemBodySchema.safeParse({
        label: "lait",
        parts: [{ quantity: 0, unitId: null }],
      }).success
    ).toBe(false);
  });

  it("modifier un article demande au moins un champ", () => {
    expect(updateShoppingItemBodySchema.safeParse({}).success).toBe(false);
    expect(updateShoppingItemBodySchema.safeParse({ checked: true }).success).toBe(true);
    expect(
      updateShoppingItemBodySchema.safeParse({ sectionId: null, rememberSection: true }).success
    ).toBe(true);
  });

  it("periode du planning : 1 a 31 jours", () => {
    expect(planPreviewBodySchema.safeParse({ from: "2026-11-24", to: "2026-11-30" }).success).toBe(
      true
    );
    expect(planPreviewBodySchema.safeParse({ from: "2026-11-24", to: "2026-11-23" }).success).toBe(
      false
    );
    expect(planPreviewBodySchema.safeParse({ from: "2026-11-01", to: "2026-12-15" }).success).toBe(
      false
    );
    expect(
      applyPlanBodySchema.safeParse({ from: "2026-11-24", to: "2026-11-30", ingredientIds: [] })
        .success
    ).toBe(false);
  });

  it("ordres sans doublon", () => {
    expect(sectionOrderBodySchema.safeParse({ ids: [ONION, ONION] }).success).toBe(false);
    expect(
      shoppingItemOrderBodySchema.safeParse({ sectionId: null, ids: [ONION, PEPPER] }).success
    ).toBe(true);
  });
});
