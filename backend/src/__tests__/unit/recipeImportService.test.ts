import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  parseIsoDuration,
  parseIngredientLine,
  importFromUrl,
} from "../../services/recipeImportService";

// --- Unit tests for parseIsoDuration ---

describe("parseIsoDuration", () => {
  it("should parse PT30M to 30", () => {
    expect(parseIsoDuration("PT30M")).toBe(30);
  });

  it("should parse PT1H to 60", () => {
    expect(parseIsoDuration("PT1H")).toBe(60);
  });

  it("should parse PT1H30M to 90", () => {
    expect(parseIsoDuration("PT1H30M")).toBe(90);
  });

  it("should parse PT2H to 120", () => {
    expect(parseIsoDuration("PT2H")).toBe(120);
  });

  it("should return null for null input", () => {
    expect(parseIsoDuration(null)).toBeNull();
  });

  it("should return null for undefined input", () => {
    expect(parseIsoDuration(undefined)).toBeNull();
  });

  it("should return null for empty string", () => {
    expect(parseIsoDuration("")).toBeNull();
  });

  it("should return null for invalid format", () => {
    expect(parseIsoDuration("30 minutes")).toBeNull();
  });

  it("should return null for PT0M (zero duration)", () => {
    expect(parseIsoDuration("PT0M")).toBeNull();
  });
});

// --- Unit tests for parseIngredientLine ---

describe("parseIngredientLine", () => {
  it("should parse quantity + unit + name: 200g de farine", () => {
    const result = parseIngredientLine("200g de farine");
    expect(result).toEqual({
      raw: "200g de farine",
      quantity: 200,
      unitAbbreviation: "g",
      name: "farine",
    });
  });

  it("should parse quantity without unit: 3 oeufs", () => {
    const result = parseIngredientLine("3 oeufs");
    expect(result).toEqual({
      raw: "3 oeufs",
      quantity: 3,
      unitAbbreviation: null,
      name: "oeufs",
    });
  });

  it("should parse with bullet prefix: - 100ml de lait", () => {
    const result = parseIngredientLine("- 100ml de lait");
    expect(result).toEqual({
      raw: "100ml de lait",
      quantity: 100,
      unitAbbreviation: "ml",
      name: "lait",
    });
  });

  it("should parse 'a gout' pattern: sel a gout", () => {
    const result = parseIngredientLine("sel a gout");
    expect(result).toEqual({
      raw: "sel a gout",
      quantity: null,
      unitAbbreviation: null,
      name: "sel",
    });
  });

  it("should parse 'selon besoin' pattern: poivre selon besoin", () => {
    const result = parseIngredientLine("poivre selon besoin");
    expect(result).toEqual({
      raw: "poivre selon besoin",
      quantity: null,
      unitAbbreviation: null,
      name: "poivre",
    });
  });

  it("should parse cs unit as cas: 2 cs de sucre", () => {
    const result = parseIngredientLine("2 cs de sucre");
    expect(result).toEqual({
      raw: "2 cs de sucre",
      quantity: 2,
      unitAbbreviation: "cas",
      name: "sucre",
    });
  });

  it("should parse cc unit as cac: 1 cc de vanille", () => {
    const result = parseIngredientLine("1 cc de vanille");
    expect(result).toEqual({
      raw: "1 cc de vanille",
      quantity: 1,
      unitAbbreviation: "cac",
      name: "vanille",
    });
  });

  it("should parse plural units: 3 gousses d'ail", () => {
    const result = parseIngredientLine("3 gousses d'ail");
    expect(result).toEqual({
      raw: "3 gousses d'ail",
      quantity: 3,
      unitAbbreviation: "gousse",
      name: "ail",
    });
  });

  it("should parse kg unit: 1.5kg de pommes de terre", () => {
    const result = parseIngredientLine("1.5kg de pommes de terre");
    expect(result).toEqual({
      raw: "1.5kg de pommes de terre",
      quantity: 1.5,
      unitAbbreviation: "kg",
      name: "pommes de terre",
    });
  });

  it("should parse fraction: 1/2 l de bouillon", () => {
    const result = parseIngredientLine("1/2 l de bouillon");
    expect(result).toEqual({
      raw: "1/2 l de bouillon",
      quantity: 0.5,
      unitAbbreviation: "l",
      name: "bouillon",
    });
  });

  it("should handle line with no pattern match", () => {
    const result = parseIngredientLine("un peu de coriandre fraiche");
    expect(result.raw).toBe("un peu de coriandre fraiche");
    expect(result.name).toBe("un peu de coriandre fraiche");
    expect(result.quantity).toBeNull();
    expect(result.unitAbbreviation).toBeNull();
  });

  it("should handle decimal with comma: 1,5 cl de creme", () => {
    const result = parseIngredientLine("1,5 cl de creme");
    expect(result.quantity).toBe(1.5);
    expect(result.unitAbbreviation).toBe("cl");
    expect(result.name).toBe("creme");
  });

  it("should parse unicode fraction ½: ½ litre de lait", () => {
    const result = parseIngredientLine("½ litre de lait");
    expect(result.quantity).toBe(0.5);
    expect(result.unitAbbreviation).toBe("l");
    expect(result.name).toBe("lait");
  });

  it("should parse unicode fraction ¼: ¼ kg de sucre", () => {
    const result = parseIngredientLine("¼ kg de sucre");
    expect(result.quantity).toBe(0.25);
    expect(result.unitAbbreviation).toBe("kg");
    expect(result.name).toBe("sucre");
  });
});

// --- Unit tests for importFromUrl ---

describe("importFromUrl", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    // Reset fetch mock before each test
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // Helper pour creer une reponse HTML avec JSON-LD
  function makeHtml(jsonLd: object): string {
    return `
      <html>
        <head>
          <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
        </head>
        <body><h1>Recipe Page</h1></body>
      </html>
    `;
  }

  function mockFetch(html: string, status = 200) {
    global.fetch = vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      headers: new Map([["content-length", String(html.length)]]),
      text: () => Promise.resolve(html),
    } as unknown as Response);
  }

  // --- URL validation ---

  it("should reject empty URL", async () => {
    await expect(importFromUrl("")).rejects.toThrow("IMPORT_001");
  });

  it("should reject non-http URL", async () => {
    await expect(importFromUrl("ftp://example.com/recipe")).rejects.toThrow("IMPORT_001");
  });

  it("should reject URL longer than 2000 chars", async () => {
    const longUrl = "https://example.com/" + "a".repeat(2000);
    await expect(importFromUrl(longUrl)).rejects.toThrow("IMPORT_001");
  });

  it("should reject invalid URL", async () => {
    await expect(importFromUrl("not a url")).rejects.toThrow("IMPORT_001");
  });

  // --- SSRF protection ---

  it("should reject localhost", async () => {
    await expect(importFromUrl("http://localhost/recipe")).rejects.toThrow("IMPORT_001");
  });

  it("should reject 127.0.0.1", async () => {
    await expect(importFromUrl("http://127.0.0.1/recipe")).rejects.toThrow("IMPORT_001");
  });

  it("should reject 10.x.x.x", async () => {
    await expect(importFromUrl("http://10.0.0.1/recipe")).rejects.toThrow("IMPORT_001");
  });

  it("should reject 172.16.x.x", async () => {
    await expect(importFromUrl("http://172.16.0.1/recipe")).rejects.toThrow("IMPORT_001");
  });

  it("should reject 192.168.x.x", async () => {
    await expect(importFromUrl("http://192.168.1.1/recipe")).rejects.toThrow("IMPORT_001");
  });

  it("should reject 0.0.0.0", async () => {
    await expect(importFromUrl("http://0.0.0.0/recipe")).rejects.toThrow("IMPORT_001");
  });

  it("should reject ::1", async () => {
    await expect(importFromUrl("http://[::1]/recipe")).rejects.toThrow("IMPORT_001");
  });

  // --- JSON-LD parsing ---

  it("should parse a direct Recipe JSON-LD object", async () => {
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Recipe",
      name: "Gateau au chocolat",
      recipeYield: "6 servings",
      prepTime: "PT20M",
      cookTime: "PT35M",
      recipeIngredient: [
        "200g de farine",
        "3 oeufs",
        "150g de sucre",
      ],
      recipeInstructions: [
        { "@type": "HowToStep", text: "Prechauffer le four a 180C." },
        { "@type": "HowToStep", text: "Melanger les ingredients." },
      ],
    };

    mockFetch(makeHtml(jsonLd));

    const result = await importFromUrl("https://example.com/recipe");

    expect(result.title).toBe("Gateau au chocolat");
    expect(result.servings).toBe(6);
    expect(result.prepTime).toBe(20);
    expect(result.cookTime).toBe(35);
    expect(result.restTime).toBeNull();
    expect(result.ingredients).toHaveLength(3);
    expect(result.ingredients[0].quantity).toBe(200);
    expect(result.ingredients[0].unitAbbreviation).toBe("g");
    expect(result.ingredients[0].name).toBe("farine");
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0]).toBe("Prechauffer le four a 180C.");
  });

  it("should parse Recipe in @graph array", async () => {
    const jsonLd = {
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "WebPage", name: "Some page" },
        {
          "@type": "Recipe",
          name: "Tarte aux pommes",
          recipeYield: "8",
          prepTime: "PT30M",
          cookTime: "PT45M",
          recipeIngredient: ["500g de pommes"],
          recipeInstructions: "Eplucher les pommes.\nCuire au four.",
        },
      ],
    };

    mockFetch(makeHtml(jsonLd));

    const result = await importFromUrl("https://example.com/recipe");

    expect(result.title).toBe("Tarte aux pommes");
    expect(result.servings).toBe(8);
    expect(result.prepTime).toBe(30);
    expect(result.cookTime).toBe(45);
    expect(result.ingredients).toHaveLength(1);
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0]).toBe("Eplucher les pommes.");
    expect(result.steps[1]).toBe("Cuire au four.");
  });

  it("should parse Recipe with schema: namespace type", async () => {
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "schema:Recipe",
      name: "Soupe",
      recipeIngredient: ["1 l d'eau"],
      recipeInstructions: [{ "@type": "HowToStep", text: "Faire bouillir." }],
    };

    mockFetch(makeHtml(jsonLd));

    const result = await importFromUrl("https://example.com/recipe");

    expect(result.title).toBe("Soupe");
  });

  it("should parse Recipe with array @type", async () => {
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": ["Recipe"],
      name: "Salade",
      recipeIngredient: ["100g de salade"],
      recipeInstructions: ["Laver la salade."],
    };

    mockFetch(makeHtml(jsonLd));

    const result = await importFromUrl("https://example.com/recipe");

    expect(result.title).toBe("Salade");
    expect(result.steps).toEqual(["Laver la salade."]);
  });

  // --- recipeInstructions formats ---

  it("should handle recipeInstructions as array of strings", async () => {
    const jsonLd = {
      "@type": "Recipe",
      name: "Test",
      recipeInstructions: [
        "Etape 1: faire ceci",
        "Etape 2: faire cela",
      ],
    };

    mockFetch(makeHtml(jsonLd));

    const result = await importFromUrl("https://example.com/recipe");

    expect(result.steps).toEqual(["Etape 1: faire ceci", "Etape 2: faire cela"]);
  });

  it("should handle recipeInstructions as HowToSection array", async () => {
    const jsonLd = {
      "@type": "Recipe",
      name: "Test",
      recipeInstructions: [
        {
          "@type": "HowToSection",
          name: "Preparation",
          itemListElement: [
            { "@type": "HowToStep", text: "Couper les legumes." },
            { "@type": "HowToStep", text: "Faire revenir." },
          ],
        },
        {
          "@type": "HowToSection",
          name: "Cuisson",
          itemListElement: [
            { "@type": "HowToStep", text: "Enfourner 30 min." },
          ],
        },
      ],
    };

    mockFetch(makeHtml(jsonLd));

    const result = await importFromUrl("https://example.com/recipe");

    expect(result.steps).toHaveLength(3);
    expect(result.steps[0]).toBe("Couper les legumes.");
    expect(result.steps[1]).toBe("Faire revenir.");
    expect(result.steps[2]).toBe("Enfourner 30 min.");
  });

  it("should handle recipeInstructions as a single string", async () => {
    const jsonLd = {
      "@type": "Recipe",
      name: "Test",
      recipeInstructions: "1. Faire ceci\n2. Faire cela\n3. Servir",
    };

    mockFetch(makeHtml(jsonLd));

    const result = await importFromUrl("https://example.com/recipe");

    expect(result.steps).toHaveLength(3);
    expect(result.steps[0]).toBe("Faire ceci");
    expect(result.steps[1]).toBe("Faire cela");
    expect(result.steps[2]).toBe("Servir");
  });

  // --- totalTime fallback ---

  it("should use totalTime as prepTime fallback when no other times", async () => {
    const jsonLd = {
      "@type": "Recipe",
      name: "Quick recipe",
      totalTime: "PT45M",
      recipeIngredient: [],
      recipeInstructions: [],
    };

    mockFetch(makeHtml(jsonLd));

    const result = await importFromUrl("https://example.com/recipe");

    expect(result.prepTime).toBe(45);
    expect(result.cookTime).toBeNull();
  });

  it("should not use totalTime as prepTime when cookTime is present", async () => {
    const jsonLd = {
      "@type": "Recipe",
      name: "Recipe with cook time",
      cookTime: "PT30M",
      totalTime: "PT60M",
      recipeIngredient: [],
      recipeInstructions: [],
    };

    mockFetch(makeHtml(jsonLd));

    const result = await importFromUrl("https://example.com/recipe");

    expect(result.prepTime).toBeNull();
    expect(result.cookTime).toBe(30);
  });

  // --- Error cases ---

  it("should throw IMPORT_003 when no JSON-LD recipe found", async () => {
    const html = "<html><body><h1>Not a recipe page</h1></body></html>";
    mockFetch(html);

    await expect(importFromUrl("https://example.com/not-recipe")).rejects.toThrow("IMPORT_003");
  });

  it("should throw IMPORT_002 when fetch fails (non-ok status)", async () => {
    mockFetch("Not found", 404);

    await expect(importFromUrl("https://example.com/404")).rejects.toThrow("IMPORT_002");
  });

  it("should throw IMPORT_002 when fetch throws network error", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    await expect(importFromUrl("https://example.com/recipe")).rejects.toThrow("IMPORT_002");
  });

  // --- recipeYield parsing ---

  it("should extract number from recipeYield string", async () => {
    const jsonLd = {
      "@type": "Recipe",
      name: "Test",
      recipeYield: "Pour 4 personnes",
      recipeInstructions: [],
    };

    mockFetch(makeHtml(jsonLd));

    const result = await importFromUrl("https://example.com/recipe");
    expect(result.servings).toBe(4);
  });

  it("should handle recipeYield as array", async () => {
    const jsonLd = {
      "@type": "Recipe",
      name: "Test",
      recipeYield: ["6 portions", "6"],
      recipeInstructions: [],
    };

    mockFetch(makeHtml(jsonLd));

    const result = await importFromUrl("https://example.com/recipe");
    expect(result.servings).toBe(6);
  });

  // --- Non-authenticated test is handled by integration tests ---
});
