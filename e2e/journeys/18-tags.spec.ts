// Parcours 18 [D216] : tags harmonises. L'auteur cree un tag d'espace depuis
// l'editeur, la moderatrice le range dans une famille, la liste des recettes
// le montre sur la carte et filtre par la feuille de filtres.
import { createRecipe } from "../support/recipes.ts";
import { expect, expectNoA11yViolations, expectToast, loginAs, test } from "../support/test.ts";

test("parcours 18 : creer un tag, le ranger dans une famille, filtrer la liste", async ({
  page,
  scenario,
}) => {
  const { owner: lea, space } = await scenario("group", {
    spaceName: "Famille",
    ownerName: "lea",
    members: [],
  });
  await loginAs(page, lea);
  const gratin = await createRecipe(page, space.id, { title: "Gratin savoyard" });
  await createRecipe(page, space.id, { title: "Salade verte" });

  // Editeur : une section Tags ; le tag "Raclette" n'existe pas, il est cree dans Famille.
  await page.goto(`/s/${space.id}/recipes/${gratin.id}/edit`);
  const tags = page.getByRole("group", { name: "Tags" });
  await tags.getByRole("button", { name: "Ajouter des tags" }).click();
  const sheet = page.getByRole("dialog", { name: "Tags de la recette" });
  await sheet.getByRole("searchbox", { name: "Chercher un tag" }).fill("Raclette");
  await sheet.getByRole("button", { name: /^Créer le tag « Raclette » dans Famille/ }).click();
  await expect(sheet.getByRole("button", { name: "Raclette" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expectNoA11yViolations(page);
  await sheet.getByRole("button", { name: "OK", exact: true }).click();
  await expect(tags.getByRole("button", { name: "Raclette, retirer le tag" })).toBeVisible();
  await page.getByRole("button", { name: "Enregistrer la révision 2" }).click();
  await expect(page.getByRole("heading", { name: "Gratin savoyard", level: 1 })).toBeVisible();

  // Reglages > Tags de l'espace : nouvelle famille, le tag y est range.
  await page.goto(`/s/${space.id}/settings`);
  await page.getByRole("link", { name: /Tags de l'espace/ }).click();
  await expect(page.getByRole("heading", { name: "Tags de Famille" })).toBeVisible();
  await page.getByRole("button", { name: "Nouvelle famille" }).click();
  const family = page.getByRole("dialog", { name: "Nouvelle famille" });
  await family.getByLabel("Nom").fill("Catégorie");
  await family.getByRole("button", { name: "Créer" }).click();
  await expectToast(page, "Famille « Catégorie » créée");
  await page.getByRole("button", { name: "Actions du tag Raclette" }).click();
  await page.getByRole("menuitem", { name: "Changer de famille" }).click();
  const move = page.getByRole("dialog", { name: "Famille de « Raclette »" });
  await move.getByLabel("Famille").selectOption({ label: "Catégorie" });
  await move.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByRole("region", { name: "Catégorie" }).getByText("Raclette")).toBeVisible();
  await expectNoA11yViolations(page);

  // Liste : le tag sous le titre de la carte ; la feuille de filtres le range par famille.
  await page.goto(`/s/${space.id}/recipes`);
  await expect(
    page.getByRole("article", { name: "Gratin savoyard" }).getByText("Raclette")
  ).toBeVisible();
  await page.getByRole("button", { name: "Filtres" }).click();
  const filters = page.getByRole("dialog", { name: "Filtres" });
  await filters
    .getByRole("group", { name: "Catégorie · Famille" })
    // Chrome lit "Raclette , 1 recette" (espace autour du texte masque).
    .getByRole("button", { name: /^Raclette ?, 1 recette$/ })
    .click();
  await expect(filters.getByRole("button", { name: "Voir 1 recette" })).toBeVisible();
  await expectNoA11yViolations(page);
  await filters.getByRole("button", { name: "Voir 1 recette" }).click();
  await expect(page.getByRole("article", { name: "Salade verte" })).toBeHidden();
  await page
    .getByRole("group", { name: "Filtres actifs" })
    .getByRole("button", { name: "Raclette, retirer le filtre" })
    .click();
  await expect(page.getByRole("article", { name: "Salade verte" })).toBeVisible();
});
