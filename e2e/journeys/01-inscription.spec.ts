// Parcours 1 (D) : inscription, arrivee dans l'espace perso, premiere recette.
// Passe par les vrais ecrans (pas de connexion par l'API).
import { expect, expectNoA11yViolations, test } from "../support/test.ts";

test(
  "parcours 1 : inscription, espace perso, premiere recette",
  { tag: "@desktop" },
  async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Forest Manager" })).toBeVisible();
    await expectNoA11yViolations(page);

    await page.getByRole("link", { name: "Créer un compte" }).click();
    await expect(page.getByRole("heading", { name: "Créer un compte" })).toBeVisible();
    await expectNoA11yViolations(page);
    await page.getByLabel("Adresse e-mail").fill("jeanne@test.local");
    await page.getByLabel("Nom d'utilisateur").fill("jeanne");
    await page.getByLabel("Mot de passe").fill("tartiflette-du-jeudi");
    await page.getByRole("button", { name: "Créer mon compte" }).click();

    // Sans SMTP dans la stack E2E : pas d'ecran "Confirme ton adresse" [D21].
    await expect(page.getByRole("heading", { name: "Bienvenue, jeanne" })).toBeVisible();
    await expectNoA11yViolations(page);
    await page.getByRole("button", { name: /Ajouter ma première recette/ }).click();

    // Espace perso, module Recettes actif d'office [D33].
    await expect(page).toHaveURL(/\/s\/[0-9a-f-]{36}\/recipes$/);
    await expect(page.getByRole("heading", { name: /Pas encore de recette/ })).toBeVisible();
    await expectNoA11yViolations(page);

    await page.getByRole("button", { name: "Nouvelle recette" }).first().click();
    const sheet = page.getByRole("dialog", { name: /Nouvelle recette dans/ });
    await expectNoA11yViolations(page);
    await sheet.getByRole("link", { name: /Saisir/ }).click();

    await page.getByLabel("Titre", { exact: true }).fill("Gratin de Jeanne");
    await page.getByLabel("Préparation (min)").fill("15");
    const first = page.getByRole("group", { name: "Ingrédient 1" }).first();
    await first.getByLabel("Quantité").fill("1,5");
    await first.getByLabel("Unité").selectOption({ label: "kg" });
    // Ingredient inconnu du referentiel : cree a l'enregistrement.
    await first.getByRole("combobox", { name: "Ingrédient" }).fill("Pommes de terre");
    await page.getByLabel("Étape 1").fill("Cuire 45 minutes.");
    await expectNoA11yViolations(page);
    await page.getByRole("button", { name: "Enregistrer" }).click();

    await expect(page.getByRole("heading", { name: "Gratin de Jeanne" })).toBeVisible();
    await expect(page.getByRole("checkbox", { name: /1,5 kg Pommes de terre/ })).toBeVisible();
    await expect(page.getByText("Cuire 45 minutes.")).toBeVisible();
    await expectNoA11yViolations(page);

    // La session et la recette survivent a un rechargement, la liste la montre.
    const recipeUrl = page.url();
    await page.goto(recipeUrl.replace(/\/recipes\/.*$/, "/recipes"));
    await expect(page.getByRole("article", { name: "Gratin de Jeanne" })).toBeVisible();
    await expectNoA11yViolations(page);
  }
);
