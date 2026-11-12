// Parcours 13 (D) : connexion admin par les ecrans (mot de passe puis code
// TOTP), fusion de deux ingredients ; la recette d'un membre suit.
import { totpFor } from "../support/admin.ts";
import { createRecipe } from "../support/recipes.ts";
import { expect, expectNoA11yViolations, expectToast, loginAs, test } from "../support/test.ts";

test(
  "parcours 13 : connexion admin avec 2FA, fusion de deux ingredients",
  { tag: "@desktop" },
  async ({ page, scenario, otherPage }) => {
    const { user: lea } = await scenario("user", { username: "lea" });
    const { admin } = await scenario("admin");
    const leaPage = await otherPage();
    await loginAs(leaPage, lea);
    await createRecipe(leaPage, lea.personalSpaceId, {
      title: "Gratin",
      ingredients: [[1, "kg", "Pomme de terre"]],
    });
    const puree = await createRecipe(leaPage, lea.personalSpaceId, {
      title: "Purée",
      ingredients: [[800, "g", "Patate"]],
    });

    // Connexion en deux etapes.
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Administration" })).toBeVisible();
    await expectNoA11yViolations(page);
    await page.getByLabel("Identifiant ou e-mail").fill(admin.username);
    await page.getByLabel("Mot de passe").fill(admin.password);
    await page.getByRole("button", { name: "Continuer" }).click();
    await expect(page.getByRole("heading", { name: "Code de vérification" })).toBeVisible();
    await expectNoA11yViolations(page);
    await page.getByLabel("Code à 6 chiffres").fill(totpFor(admin));
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByText(/Session admin, expire dans/).first()).toBeAttached();
    await expectNoA11yViolations(page);

    // Les deux ingredients crees par Lea attendent dans "Nouveaux".
    await page.goto("/admin/ingredients");
    await expect(page.getByRole("heading", { name: "Ingrédients", level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Pomme de terre/ })).toBeVisible();
    await page.getByRole("button", { name: /^Patate/ }).click();
    await expectNoA11yViolations(page);

    // Fusion de "Patate" dans "Pomme de terre".
    await page.getByRole("button", { name: /^Fusionner/ }).click();
    const sheet = page.getByRole("dialog", { name: "Fusionner « Patate »" });
    await sheet.getByLabel("Chercher un autre ingrédient").fill("Pomme");
    await sheet.getByRole("radio", { name: /Pomme de terre/ }).check();
    await expect(
      sheet.getByText("La recette « Purée » de lea utilisera « Pomme de terre »", { exact: false })
    ).toBeVisible();
    await expectNoA11yViolations(page);
    await sheet.getByRole("button", { name: "Fusionner", exact: true }).click();
    await expectToast(page, "« Patate » fusionné dans « Pomme de terre »");
    await expect(page.getByRole("button", { name: /^Patate/ })).toHaveCount(0);
    await expect(page.getByText("Synonymes : Patate")).toBeVisible();
    await expectNoA11yViolations(page);

    // Chez Lea, la puree utilise maintenant l'ingredient garde, quantite inchangee.
    await leaPage.goto(`/s/${lea.personalSpaceId}/recipes/${puree.id}`);
    await expect(leaPage.getByRole("heading", { name: "Purée" })).toBeVisible();
    await expect(leaPage.getByRole("checkbox", { name: /800 g Pomme de terre/ })).toBeVisible();
  }
);
