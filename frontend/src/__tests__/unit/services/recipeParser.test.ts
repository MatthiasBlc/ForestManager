import { describe, it, expect } from 'vitest';
import { parseRecipeText, ParsedRecipe } from '../../../services/recipeParser';

describe('parseRecipeText', () => {
  // --- Cas nominal : recette complete bien formatee ---
  describe('nominal case - complete well-formatted recipe', () => {
    const input = `Gateau au chocolat

Pour 6 personnes
Preparation : 20 min
Cuisson : 35 min

Ingredients :
- 200g de farine
- 3 oeufs
- 150g de sucre
- 100g de beurre
- 200g de chocolat noir
- 1 sachet de levure

Preparation :
1. Prechauffer le four a 180C.
2. Faire fondre le chocolat avec le beurre.
3. Melanger la farine, le sucre et la levure.
4. Ajouter les oeufs un a un.
5. Incorporer le chocolat fondu.
6. Verser dans un moule et enfourner 35 minutes.`;

    let result: ParsedRecipe;

    beforeAll(() => {
      result = parseRecipeText(input);
    });

    it('should extract the title', () => {
      expect(result.title).toBe('Gateau au chocolat');
    });

    it('should extract servings', () => {
      expect(result.servings).toBe(6);
    });

    it('should extract prep time', () => {
      expect(result.prepTime).toBe(20);
    });

    it('should extract cook time', () => {
      expect(result.cookTime).toBe(35);
    });

    it('should have null rest time when not present', () => {
      expect(result.restTime).toBeNull();
    });

    it('should extract all 6 ingredients', () => {
      expect(result.ingredients).toHaveLength(6);
    });

    it('should parse ingredient with unit (200g de farine)', () => {
      const farine = result.ingredients[0];
      expect(farine.raw).toBe('200g de farine');
      expect(farine.quantity).toBe(200);
      expect(farine.unitAbbreviation).toBe('g');
      expect(farine.name).toBe('farine');
    });

    it('should parse ingredient without unit (3 oeufs)', () => {
      const oeufs = result.ingredients[1];
      expect(oeufs.quantity).toBe(3);
      expect(oeufs.unitAbbreviation).toBeNull();
      expect(oeufs.name).toBe('oeufs');
    });

    it('should parse ingredient without unit but with "de" particle (1 sachet de levure)', () => {
      const levure = result.ingredients[5];
      expect(levure.quantity).toBe(1);
      expect(levure.unitAbbreviation).toBeNull();
      expect(levure.name).toBe('sachet de levure');
    });

    it('should extract all 6 steps', () => {
      expect(result.steps).toHaveLength(6);
    });

    it('should strip numbering from steps', () => {
      expect(result.steps[0]).toBe('Prechauffer le four a 180C.');
      expect(result.steps[5]).toBe('Verser dans un moule et enfourner 35 minutes.');
    });
  });

  // --- Recette sans headers de section (fallback) ---
  describe('recipe without section headers (fallback detection)', () => {
    const input = `Salade composee

4 personnes

200g de lentilles
3 tomates
1 concombre
2 cas de vinaigre

1. Cuire les lentilles 20 minutes.
2. Couper les tomates et le concombre.
3. Melanger le tout avec le vinaigre.`;

    let result: ParsedRecipe;

    beforeAll(() => {
      result = parseRecipeText(input);
    });

    it('should detect the title', () => {
      expect(result.title).toBe('Salade composee');
    });

    it('should detect servings', () => {
      expect(result.servings).toBe(4);
    });

    it('should detect ingredients by pattern', () => {
      expect(result.ingredients.length).toBeGreaterThanOrEqual(3);
      expect(result.ingredients[0].name).toBe('lentilles');
      expect(result.ingredients[0].quantity).toBe(200);
      expect(result.ingredients[0].unitAbbreviation).toBe('g');
    });

    it('should map "cas" to DB abbreviation', () => {
      const vinaigre = result.ingredients.find((i) => i.name?.includes('vinaigre'));
      expect(vinaigre).toBeDefined();
      expect(vinaigre!.unitAbbreviation).toBe('cas');
      expect(vinaigre!.quantity).toBe(2);
    });

    it('should detect numbered steps', () => {
      expect(result.steps).toHaveLength(3);
      expect(result.steps[0]).toBe('Cuire les lentilles 20 minutes.');
    });
  });

  // --- Formats d'ingredients varies ---
  describe('various ingredient formats', () => {
    it('should handle ingredient with "d\'" particle', () => {
      const result = parseRecipeText(`Test\n\nIngredients :\n- 200g d'amandes`);
      expect(result.ingredients[0].quantity).toBe(200);
      expect(result.ingredients[0].unitAbbreviation).toBe('g');
      expect(result.ingredients[0].name).toBe('amandes');
    });

    it('should handle fraction quantities (1/2)', () => {
      const result = parseRecipeText(`Test\n\nIngredients :\n- 1/2 l de lait`);
      expect(result.ingredients[0].quantity).toBe(0.5);
      expect(result.ingredients[0].unitAbbreviation).toBe('l');
      expect(result.ingredients[0].name).toBe('lait');
    });

    it('should handle "a gout" pattern', () => {
      const result = parseRecipeText(`Test\n\nIngredients :\n- Sel, a gout`);
      expect(result.ingredients[0].quantity).toBeNull();
      expect(result.ingredients[0].unitAbbreviation).toBe('a gout');
      expect(result.ingredients[0].name).toBe('Sel');
    });

    it('should handle "selon besoin" pattern', () => {
      const result = parseRecipeText(`Test\n\nIngredients :\n- Poivre selon besoin`);
      expect(result.ingredients[0].quantity).toBeNull();
      expect(result.ingredients[0].unitAbbreviation).toBe('selon besoin');
      expect(result.ingredients[0].name).toBe('Poivre');
    });

    it('should handle decimal quantities', () => {
      const result = parseRecipeText(`Test\n\nIngredients :\n- 1,5 kg de poulet`);
      expect(result.ingredients[0].quantity).toBe(1.5);
      expect(result.ingredients[0].unitAbbreviation).toBe('kg');
      expect(result.ingredients[0].name).toBe('poulet');
    });

    it('should handle ingredient with no quantity as fallback', () => {
      const result = parseRecipeText(`Test\n\nIngredients :\n- huile d'olive`);
      expect(result.ingredients[0].quantity).toBeNull();
      expect(result.ingredients[0].unitAbbreviation).toBeNull();
      expect(result.ingredients[0].name).toBe("huile d'olive");
    });

    it('should handle "ml" unit', () => {
      const result = parseRecipeText(`Test\n\nIngredients :\n- 250 ml de creme`);
      expect(result.ingredients[0].quantity).toBe(250);
      expect(result.ingredients[0].unitAbbreviation).toBe('ml');
      expect(result.ingredients[0].name).toBe('creme');
    });

    it('should handle "cl" unit', () => {
      const result = parseRecipeText(`Test\n\nIngredients :\n- 25 cl de vin blanc`);
      expect(result.ingredients[0].quantity).toBe(25);
      expect(result.ingredients[0].unitAbbreviation).toBe('cl');
      expect(result.ingredients[0].name).toBe('vin blanc');
    });

    it('should handle "cc" mapping to "cac"', () => {
      const result = parseRecipeText(`Test\n\nIngredients :\n- 2 cc de vanille`);
      expect(result.ingredients[0].quantity).toBe(2);
      expect(result.ingredients[0].unitAbbreviation).toBe('cac');
      expect(result.ingredients[0].name).toBe('vanille');
    });

    it('should handle "cs" mapping to "cas"', () => {
      const result = parseRecipeText(`Test\n\nIngredients :\n- 3 cs de miel`);
      expect(result.ingredients[0].quantity).toBe(3);
      expect(result.ingredients[0].unitAbbreviation).toBe('cas');
      expect(result.ingredients[0].name).toBe('miel');
    });

    it('should handle "pincee" unit', () => {
      const result = parseRecipeText(`Test\n\nIngredients :\n- 1 pincee de sel`);
      expect(result.ingredients[0].quantity).toBe(1);
      expect(result.ingredients[0].unitAbbreviation).toBe('pincee');
      expect(result.ingredients[0].name).toBe('sel');
    });

    it('should handle "gousses" (plural) mapping to "gousse"', () => {
      const result = parseRecipeText(`Test\n\nIngredients :\n- 2 gousses d'ail`);
      expect(result.ingredients[0].quantity).toBe(2);
      expect(result.ingredients[0].unitAbbreviation).toBe('gousse');
      expect(result.ingredients[0].name).toBe('ail');
    });

    it('should handle "feuilles" mapping to "feuille"', () => {
      const result = parseRecipeText(`Test\n\nIngredients :\n- 3 feuilles de laurier`);
      expect(result.ingredients[0].quantity).toBe(3);
      expect(result.ingredients[0].unitAbbreviation).toBe('feuille');
      expect(result.ingredients[0].name).toBe('laurier');
    });

    it('should handle "brin" unit', () => {
      const result = parseRecipeText(`Test\n\nIngredients :\n- 2 brins de thym`);
      expect(result.ingredients[0].quantity).toBe(2);
      expect(result.ingredients[0].unitAbbreviation).toBe('brin');
      expect(result.ingredients[0].name).toBe('thym');
    });

    it('should handle "botte" unit', () => {
      const result = parseRecipeText(`Test\n\nIngredients :\n- 1 botte de persil`);
      expect(result.ingredients[0].quantity).toBe(1);
      expect(result.ingredients[0].unitAbbreviation).toBe('botte');
      expect(result.ingredients[0].name).toBe('persil');
    });

    it('should handle "tranche" unit', () => {
      const result = parseRecipeText(`Test\n\nIngredients :\n- 4 tranches de jambon`);
      expect(result.ingredients[0].quantity).toBe(4);
      expect(result.ingredients[0].unitAbbreviation).toBe('tranche');
      expect(result.ingredients[0].name).toBe('jambon');
    });

    it('should handle various bullet styles', () => {
      const result = parseRecipeText(
        `Test\n\nIngredients :\n- 1 pomme\n* 2 poires\n• 3 bananes`
      );
      expect(result.ingredients).toHaveLength(3);
      expect(result.ingredients[0].name).toBe('pomme');
      expect(result.ingredients[1].name).toBe('poires');
      expect(result.ingredients[2].name).toBe('bananes');
    });
  });

  // --- Temps en heures et minutes ---
  describe('time parsing', () => {
    it('should parse time in hours (1h30)', () => {
      const result = parseRecipeText(`Test\nPreparation : 1h30`);
      expect(result.prepTime).toBe(90);
    });

    it('should parse time in minutes (45 min)', () => {
      const result = parseRecipeText(`Test\nCuisson : 45 min`);
      expect(result.cookTime).toBe(45);
    });

    it('should parse time in hours only (2h)', () => {
      const result = parseRecipeText(`Test\nPreparation : 2h`);
      expect(result.prepTime).toBe(120);
    });

    it('should parse rest time', () => {
      const result = parseRecipeText(`Test\nRepos : 30 min`);
      expect(result.restTime).toBe(30);
    });

    it('should parse "pause" as rest time', () => {
      const result = parseRecipeText(`Test\nPause : 1h`);
      expect(result.restTime).toBe(60);
    });

    it('should use generic "temps" as prepTime fallback', () => {
      const result = parseRecipeText(`Test\nTemps : 25 min`);
      expect(result.prepTime).toBe(25);
    });

    it('should not override prepTime with generic "temps"', () => {
      const result = parseRecipeText(`Test\nPreparation : 15 min\nTemps : 45 min`);
      expect(result.prepTime).toBe(15);
    });
  });

  // --- Texte avec separateurs visuels ---
  describe('text with visual separators', () => {
    it('should remove separator lines and parse correctly', () => {
      const input = `Tarte aux pommes
---
Ingredients :
- 200g de farine
- 3 pommes
===
Preparation :
1. Preparer la pate.
2. Disposer les pommes.`;

      const result = parseRecipeText(input);
      expect(result.title).toBe('Tarte aux pommes');
      expect(result.ingredients).toHaveLength(2);
      expect(result.steps).toHaveLength(2);
    });

    it('should handle underscores and tildes as separators', () => {
      const input = `Test
___
~~~
Ingredients :
- 100g de beurre`;

      const result = parseRecipeText(input);
      expect(result.title).toBe('Test');
      expect(result.ingredients).toHaveLength(1);
    });
  });

  // --- Texte minimal (juste un titre) ---
  describe('minimal text', () => {
    it('should detect only a title from a short text', () => {
      const result = parseRecipeText('Ma recette preferee');
      expect(result.title).toBe('Ma recette preferee');
      expect(result.ingredients).toHaveLength(0);
      expect(result.steps).toHaveLength(0);
      expect(result.servings).toBeNull();
      expect(result.prepTime).toBeNull();
      expect(result.cookTime).toBeNull();
      expect(result.restTime).toBeNull();
    });
  });

  // --- Texte vide ---
  describe('empty text', () => {
    it('should return empty result for empty string', () => {
      const result = parseRecipeText('');
      expect(result.title).toBeNull();
      expect(result.ingredients).toHaveLength(0);
      expect(result.steps).toHaveLength(0);
    });

    it('should return empty result for whitespace-only string', () => {
      const result = parseRecipeText('   \n\n   \n  ');
      expect(result.title).toBeNull();
      expect(result.ingredients).toHaveLength(0);
      expect(result.steps).toHaveLength(0);
    });

    it('should return empty result for null-ish input', () => {
      const result = parseRecipeText('' as string);
      expect(result.title).toBeNull();
    });
  });

  // --- Edge cases: "de" / "d'" particles ---
  describe('edge cases with particles', () => {
    it('should handle "de" particle correctly', () => {
      const result = parseRecipeText(`Test\n\nIngredients :\n- 500g de pommes de terre`);
      expect(result.ingredients[0].quantity).toBe(500);
      expect(result.ingredients[0].unitAbbreviation).toBe('g');
      expect(result.ingredients[0].name).toBe('pommes de terre');
    });

    it('should handle "d\'" particle correctly', () => {
      const result = parseRecipeText(`Test\n\nIngredients :\n- 100ml d'huile d'olive`);
      expect(result.ingredients[0].quantity).toBe(100);
      expect(result.ingredients[0].unitAbbreviation).toBe('ml');
      expect(result.ingredients[0].name).toBe("huile d'olive");
    });

    it('should handle quantity with space before unit', () => {
      const result = parseRecipeText(`Test\n\nIngredients :\n- 200 g de farine`);
      expect(result.ingredients[0].quantity).toBe(200);
      expect(result.ingredients[0].unitAbbreviation).toBe('g');
      expect(result.ingredients[0].name).toBe('farine');
    });
  });

  // --- Section header variants ---
  describe('section header variants', () => {
    it('should recognize "Etapes" as steps header', () => {
      const result = parseRecipeText(
        `Test\n\nIngredients :\n- 1 pomme\n\nEtapes :\n1. Laver la pomme.`
      );
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0]).toBe('Laver la pomme.');
    });

    it('should recognize "Instructions" as steps header', () => {
      const result = parseRecipeText(
        `Test\n\nIngredients :\n- 1 pomme\n\nInstructions :\n1. Laver la pomme.`
      );
      expect(result.steps).toHaveLength(1);
    });

    it('should handle headers with accents', () => {
      const result = parseRecipeText(
        `Test\n\nIngr\u00e9dients :\n- 1 pomme\n\nPr\u00e9paration :\n1. Laver.`
      );
      expect(result.ingredients).toHaveLength(1);
      expect(result.steps).toHaveLength(1);
    });

    it('should handle headers without colon', () => {
      const result = parseRecipeText(
        `Test\n\nIngredients\n- 1 pomme\n\nPreparation\n1. Laver.`
      );
      expect(result.ingredients).toHaveLength(1);
      expect(result.steps).toHaveLength(1);
    });
  });

  // --- Step formatting ---
  describe('step formatting', () => {
    it('should strip "Etape X :" prefix', () => {
      const result = parseRecipeText(
        `Test\n\nPreparation :\nEtape 1 : Faire bouillir.\nEtape 2 : Servir.`
      );
      expect(result.steps[0]).toBe('Faire bouillir.');
      expect(result.steps[1]).toBe('Servir.');
    });

    it('should strip bullet-style steps', () => {
      const result = parseRecipeText(
        `Test\n\nPreparation :\n- Faire bouillir.\n- Servir.`
      );
      expect(result.steps[0]).toBe('Faire bouillir.');
      expect(result.steps[1]).toBe('Servir.');
    });

    it('should strip parenthesis-style numbering', () => {
      const result = parseRecipeText(
        `Test\n\nPreparation :\n1) Faire bouillir.\n2) Servir.`
      );
      expect(result.steps[0]).toBe('Faire bouillir.');
      expect(result.steps[1]).toBe('Servir.');
    });
  });

  // --- Windows-style line endings ---
  describe('line ending normalization', () => {
    it('should handle \\r\\n line endings', () => {
      const input = 'Test\r\n\r\nIngredients :\r\n- 1 pomme\r\n\r\nPreparation :\r\n1. Laver.';
      const result = parseRecipeText(input);
      expect(result.title).toBe('Test');
      expect(result.ingredients).toHaveLength(1);
      expect(result.steps).toHaveLength(1);
    });
  });

  // --- "cuillere a soupe" long unit ---
  describe('long unit patterns', () => {
    it('should parse "cuillere a soupe"', () => {
      const result = parseRecipeText(
        `Test\n\nIngredients :\n- 2 cuilleres a soupe de moutarde`
      );
      expect(result.ingredients[0].quantity).toBe(2);
      expect(result.ingredients[0].unitAbbreviation).toBe('cas');
      expect(result.ingredients[0].name).toBe('moutarde');
    });

    it('should parse "cuillere a cafe"', () => {
      const result = parseRecipeText(
        `Test\n\nIngredients :\n- 1 cuillere a cafe de sel`
      );
      expect(result.ingredients[0].quantity).toBe(1);
      expect(result.ingredients[0].unitAbbreviation).toBe('cac');
      expect(result.ingredients[0].name).toBe('sel');
    });
  });

  describe('unicode fractions', () => {
    it('should parse ½ as 0.5', () => {
      const result = parseRecipeText(
        `Test\n\nIngredients :\n- ½ litre de lait`
      );
      expect(result.ingredients).toHaveLength(1);
      expect(result.ingredients[0].quantity).toBe(0.5);
      expect(result.ingredients[0].unitAbbreviation).toBe('l');
      expect(result.ingredients[0].name).toBe('lait');
    });

    it('should parse ¼ as 0.25', () => {
      const result = parseRecipeText(
        `Test\n\nIngredients :\n- ¼ kg de sucre`
      );
      expect(result.ingredients[0].quantity).toBe(0.25);
      expect(result.ingredients[0].unitAbbreviation).toBe('kg');
    });

    it('should detect ½ ingredient in fallback mode (no headers)', () => {
      const result = parseRecipeText(
        `CREPES\n3 oeufs\n250 g de farine\n½ litre de lait\n1 pincee de sel`
      );
      expect(result.title).toBe('CREPES');
      expect(result.ingredients.length).toBeGreaterThanOrEqual(4);
      const lait = result.ingredients.find(i => i.name === 'lait');
      expect(lait).toBeDefined();
      expect(lait!.quantity).toBe(0.5);
      expect(lait!.unitAbbreviation).toBe('l');
    });
  });
});
