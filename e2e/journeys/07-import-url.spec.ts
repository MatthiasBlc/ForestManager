// Parcours 7 : importer une recette depuis une URL de test, corriger le
// formulaire, enregistrer. La page vient de `apps/api/test/fixtures/import/`,
// servie par la route de test et lue par l'API sur sa boucle locale (aucun
// appel a Internet).
import { expect, expectNoA11yViolations, loginAs, test } from "../support/test.ts";

const FIXTURE = "http://127.0.0.1:3001/api/v1/__test/fixtures/import/tarte-tatin.html";

test("parcours 7 : import par lien, correction, enregistrement", async ({ page, scenario }) => {
  const { user: lea } = await scenario("user", { username: "lea" });
  await loginAs(page, lea);
  await page.goto(`/s/${lea.personalSpaceId}/recipes`);

  // Nouvelle recette > Importer un lien.
  await page.getByRole("button", { name: "Nouvelle recette" }).first().click();
  await page
    .getByRole("dialog", { name: /Nouvelle recette dans/ })
    .getByRole("button", { name: /Importer un lien/ })
    .click();
  const sheet = page.getByRole("dialog", { name: "Importer depuis un lien" });
  // Un lien incomplet est refuse avant tout appel.
  await sheet.getByLabel("Lien de la recette").fill("tarte tatin");
  await sheet.getByRole("button", { name: "Importer" }).click();
  await expect(sheet.getByText("Colle un lien complet, qui commence par https://")).toBeVisible();
  await sheet.getByLabel("Lien de la recette").fill(FIXTURE);
  await expectNoA11yViolations(page);
  await sheet.getByRole("button", { name: "Importer" }).click();

  // L'editeur s'ouvre pre-rempli, avec la quantite en plage a verifier.
  await expect(page).toHaveURL(/\/recipes\/new$/);
  await expect(page.getByText(/Recette importée\..*1 quantité à vérifier\./)).toBeVisible();
  await expect(page.getByLabel("Titre", { exact: true })).toHaveValue("Tarte tatin");
  await expect(page.getByLabel("Préparation (min)")).toHaveValue("20");
  await expect(page.getByRole("textbox", { name: "Étape 1" })).toHaveValue(
    "Faire un caramel avec le sucre et le beurre."
  );
  await expectNoA11yViolations(page);

  // Correction : le beurre en grammes, un titre plus precis.
  await page.getByLabel("Titre", { exact: true }).fill("Tarte tatin de Lea");
  const butter = page.getByRole("group", { name: "Ingrédient 3" }).first();
  await butter.getByLabel("Quantité").fill("40");
  await butter.getByLabel("Unité").selectOption({ label: "g" });
  await butter.getByRole("combobox", { name: "Ingrédient" }).fill("Beurre");
  await page.getByRole("button", { name: "Enregistrer" }).click();

  // Enregistree telle que corrigee, avec sa source.
  await expect(page.getByRole("heading", { name: "Tarte tatin de Lea" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "40 g Beurre" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /100 g Sucre/i })).toBeVisible();
  await expect(page.getByText("Ranger les pommes, couvrir de pâte, cuire.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Voir la source" })).toHaveAttribute("href", FIXTURE);
  await expectNoA11yViolations(page);
});
