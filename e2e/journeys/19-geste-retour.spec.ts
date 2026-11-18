// Parcours 19 [D219] : la fleche de retour d'une recette remonte l'historique
// jusqu'a la page d'origine ; le retour du navigateur (geste retour d'Android)
// part ensuite d'avant l'origine au lieu de revenir sur la recette.
import { createRecipe } from "../support/recipes.ts";
import { expect, loginAs, test } from "../support/test.ts";

test("parcours 19 : fleche de retour puis retour du navigateur, sans repasser par la recette", async ({
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
  const recipeUrl = new RegExp(`/recipes/${gratin.id}`);

  // Accueil -> liste -> recette, puis la fleche : retour a la liste.
  await page.goto(`/s/${space.id}/home`);
  await page.goto(`/s/${space.id}/recipes`);
  await page.getByRole("article", { name: "Gratin savoyard" }).click();
  await expect(page.getByRole("heading", { name: "Gratin savoyard", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Retour" }).click();
  await expect(page).toHaveURL(new RegExp(`/s/${space.id}/recipes$`));

  // Le retour du navigateur mene a l'accueil, pas a la recette.
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/s/${space.id}/home$`));
  await expect(page).not.toHaveURL(recipeUrl);

  // Lien direct, sans origine retenue (onglet neuf) : la fleche remplace la recette
  // par la liste, le retour du navigateur saute la recette.
  await page.evaluate(() => {
    sessionStorage.clear();
  });
  await page.goto(`/s/${space.id}/recipes/${gratin.id}`);
  await expect(page.getByRole("heading", { name: "Gratin savoyard", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Retour" }).click();
  await expect(page).toHaveURL(new RegExp(`/s/${space.id}/recipes$`));
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/s/${space.id}/home$`));
});
