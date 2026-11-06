// Import de recettes (C3.8) : lignes d'ingredients, JSON-LD schema.org/Recipe,
// texte colle. Cas HelloFresh repris de la V1.
import { describe, expect, it } from "vitest";

import {
  extractJsonLd,
  findJsonLdRecipe,
  fromJsonLd,
  parseDuration,
  parseIngredientLine,
  parseRecipeText,
} from "../src/recipes/import.ts";

describe("parseIngredientLine", () => {
  it.each([
    ["200 g de farine", { quantity: 200, unitCode: "g", name: "farine" }],
    ["200g farine", { quantity: 200, unitCode: "g", name: "farine" }],
    ["1,5 kg de pommes de terre", { quantity: 1.5, unitCode: "kg", name: "pommes de terre" }],
    ["25 cl de crème liquide", { quantity: 25, unitCode: "cl", name: "crème liquide" }],
    ["2 dl de lait", { quantity: 20, unitCode: "cl", name: "lait" }],
    ["1 l d'eau", { quantity: 1, unitCode: "l", name: "eau" }],
    ["2 c. à soupe d'huile d'olive", { quantity: 2, unitCode: "tbsp", name: "huile d'olive" }],
    ["2 cuillères à soupe de sucre", { quantity: 2, unitCode: "tbsp", name: "sucre" }],
    ["1 càs de miel", { quantity: 1, unitCode: "tbsp", name: "miel" }],
    ["1 cs de sauce soja", { quantity: 1, unitCode: "tbsp", name: "sauce soja" }],
    ["1 c.à.c de sel", { quantity: 1, unitCode: "tsp", name: "sel" }],
    ["1 cuillère à café de cumin", { quantity: 1, unitCode: "tsp", name: "cumin" }],
    ["3 gousses d'ail", { quantity: 3, unitCode: "clove", name: "ail" }],
    ["1 pincée de muscade", { quantity: 1, unitCode: "pinch", name: "muscade" }],
    ["1 sachet de levure", { quantity: 1, unitCode: "sachet", name: "levure" }],
    ["1 boîte de pois chiches", { quantity: 1, unitCode: "can", name: "pois chiches" }],
    ["4 tranches de jambon", { quantity: 4, unitCode: "slice", name: "jambon" }],
    ["1 botte de radis", { quantity: 1, unitCode: "bunch", name: "radis" }],
    ["3 œufs", { quantity: 3, unitCode: null, name: "œufs" }],
    ["1/2 citron", { quantity: 0.5, unitCode: null, name: "citron" }],
    ["½ citron", { quantity: 0.5, unitCode: null, name: "citron" }],
    ["1 1/2 tasse de riz", { quantity: 1.5, unitCode: "cup", name: "riz" }],
    ["2 gingembre frais", { quantity: 2, unitCode: null, name: "gingembre frais" }],
    // HelloFresh
    ["2 pièce(s) Aubergine", { quantity: 2, unitCode: "piece", name: "Aubergine" }],
    ["1 sachet(s) Noix de cajou", { quantity: 1, unitCode: "sachet", name: "Noix de cajou" }],
    [
      "selon le goût Poivre et sel",
      { quantity: null, unitCode: "to-taste", name: "Poivre et sel" },
    ],
    ["Sel, à goût", { quantity: null, unitCode: "to-taste", name: "Sel" }],
    ["poivre selon envie", { quantity: null, unitCode: "to-taste", name: "poivre" }],
  ])("%s", (line, expected) => {
    expect(parseIngredientLine(line)).toMatchObject({ ...expected, check: false });
  });

  it("met le detail apres la virgule en note", () => {
    expect(parseIngredientLine("- 1 oignon, finement émincé")).toMatchObject({
      quantity: 1,
      name: "oignon",
      note: "finement émincé",
    });
  });

  it("signale une quantite a verifier (absente ou en fourchette)", () => {
    expect(parseIngredientLine("Persil")).toMatchObject({
      quantity: null,
      name: "Persil",
      check: true,
    });
    expect(parseIngredientLine("2-3 carottes")).toMatchObject({
      quantity: 2,
      name: "carottes",
      check: true,
    });
  });
});

describe("parseDuration", () => {
  it.each([
    ["PT20M", 20],
    ["PT1H30M", 90],
    ["P0DT1H0M", 60],
    ["PT2H", 120],
    ["PT0M", null],
    ["20 min", null],
    [null, null],
  ])("%s", (value, minutes) => {
    expect(parseDuration(value)).toBe(minutes);
  });
});

const HELLOFRESH_HTML = `<!doctype html><html><head>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList"}</script>
<script type="application/ld+json">
{"@context":"http://schema.org","@type":"Recipe","name":"Curry d&#39;aubergine &amp; noix de cajou",
 "recipeYield":"2 personnes","prepTime":"PT15M","cookTime":"PT25M","totalTime":"PT40M",
 "recipeIngredient":["2 pièce(s) Aubergine","1 sachet(s) Noix de cajou","selon le goût Poivre et sel"],
 "recipeInstructions":[
   {"@type":"HowToStep","text":"<ul>\\n<li>Préchauffer le four à 200°C.</li>\\n<li>Couper les légumes.</li>\\n</ul>"},
   {"@type":"HowToStep","text":"Faire cuire 25&nbsp;min."}]}
</script></head><body></body></html>`;

describe("JSON-LD", () => {
  it("trouve la recette parmi les blocs, dans @graph ou un tableau", () => {
    expect(findJsonLdRecipe(extractJsonLd(HELLOFRESH_HTML))).toMatchObject({ "@type": "Recipe" });
    const graph = { "@graph": [{ "@type": "WebPage" }, { "@type": ["Recipe"], name: "G" }] };
    expect(findJsonLdRecipe([graph])).toMatchObject({ name: "G" });
    expect(findJsonLdRecipe([[{ "@type": "schema:Recipe", name: "A" }]])).toMatchObject({
      name: "A",
    });
    expect(findJsonLdRecipe([{ "@type": "Article" }])).toBeNull();
  });

  it("ignore un bloc JSON invalide", () => {
    const html = `<script type="application/ld+json">{oops</script>
      <script type='application/ld+json'>{"@type":"Recipe","name":"Ok"}</script>`;
    expect(findJsonLdRecipe(extractJsonLd(html))).toMatchObject({ name: "Ok" });
  });

  it("convertit une recette HelloFresh (HTML et entites dans les etapes)", () => {
    const recipe = fromJsonLd(findJsonLdRecipe(extractJsonLd(HELLOFRESH_HTML)), "https://hf.fr/r");
    expect(recipe).toMatchObject({
      title: "Curry d'aubergine & noix de cajou",
      yieldQuantity: 2,
      prepMinutes: 15,
      cookMinutes: 25,
      restMinutes: null,
      sourceUrl: "https://hf.fr/r",
      steps: ["Préchauffer le four à 200°C.", "Couper les légumes.", "Faire cuire 25 min."],
    });
    expect(recipe.ingredients.map((i) => [i.quantity, i.unitCode, i.name])).toEqual([
      [2, "piece", "Aubergine"],
      [1, "sachet", "Noix de cajou"],
      [null, "to-taste", "Poivre et sel"],
    ]);
  });

  it("lit les sections d'etapes, un rendement numerique et un temps total seul", () => {
    const recipe = fromJsonLd(
      {
        "@type": "Recipe",
        name: "Tarte",
        recipeYield: [6, "6 parts"],
        totalTime: "PT1H",
        recipeInstructions: [
          {
            "@type": "HowToSection",
            name: "Pâte",
            itemListElement: [{ "@type": "HowToStep", text: "Pétrir." }],
          },
          "2. Cuire.",
        ],
      },
      null
    );
    expect(recipe).toMatchObject({
      yieldQuantity: 6,
      prepMinutes: 60,
      cookMinutes: null,
      steps: ["Pétrir.", "Cuire."],
    });
  });
});

describe("parseRecipeText", () => {
  it("lit une recette avec sections, temps et portions", () => {
    const recipe = parseRecipeText(`Gâteau au yaourt

Pour 6 personnes
Préparation : 15 min
Cuisson : 1h05
Repos : 30 min

Ingrédients
- 1 pot de yaourt
- 200 g de farine
- 3 œufs
- sel

Préparation
1. Mélanger le yaourt et les œufs.
2) Ajouter la farine.
Étape 3 : Cuire 35 min.
`);
    expect(recipe).toMatchObject({
      title: "Gâteau au yaourt",
      yieldQuantity: 6,
      prepMinutes: 15,
      cookMinutes: 65,
      restMinutes: 30,
      steps: ["Mélanger le yaourt et les œufs.", "Ajouter la farine.", "Cuire 35 min."],
    });
    expect(recipe.ingredients.map((i) => i.name)).toEqual([
      "pot de yaourt",
      "farine",
      "œufs",
      "sel",
    ]);
    expect(recipe.ingredients.filter((i) => i.check)).toHaveLength(1);
  });

  it("devine ingredients et etapes sans titres de sections", () => {
    const recipe = parseRecipeText(`Vinaigrette
3 c. à soupe d'huile
1 c. à soupe de vinaigre
1. Tout mélanger dans un bol.
2. Servir aussitôt.`);
    expect(recipe.title).toBe("Vinaigrette");
    expect(recipe.ingredients.map((i) => i.unitCode)).toEqual(["tbsp", "tbsp"]);
    expect(recipe.steps).toEqual(["Tout mélanger dans un bol.", "Servir aussitôt."]);
  });

  it("sans sections : une ligne courte sans quantite apres des ingredients en est un", () => {
    const recipe = parseRecipeText(`Gratin de Jeanne
500 g de pâtes
40 cl de crème
150 g de gruyère râpé
1 gousse d'ail
sel, poivre
Cuire les pâtes al dente.
Frotter le plat avec l'ail
Mélanger et gratiner 20 min.`);
    expect(recipe.ingredients.map((i) => i.name)).toEqual([
      "pâtes",
      "crème",
      "gruyère râpé",
      "ail",
      "sel, poivre",
    ]);
    // Sans quantite, la virgule separe une liste, pas une note ("oignon, emince").
    expect(recipe.ingredients.at(-1)).toMatchObject({ quantity: null, note: null, check: true });
    // Une fois les etapes commencees, une ligne courte reste une etape.
    expect(recipe.steps).toEqual([
      "Cuire les pâtes al dente.",
      "Frotter le plat avec l'ail",
      "Mélanger et gratiner 20 min.",
    ]);
  });

  it("ignore les separateurs ; texte vide = recette vide", () => {
    expect(parseRecipeText("Salade\n-----\n~~~\n").title).toBe("Salade");
    expect(parseRecipeText("  \n ")).toMatchObject({ title: null, ingredients: [], steps: [] });
  });
});
