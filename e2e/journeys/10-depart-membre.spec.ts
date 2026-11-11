// Parcours 10 : un membre quitte l'espace ; ses recettes restent et un
// moderateur les reprend.
import { createRecipe } from "../support/recipes.ts";
import { expect, expectNoA11yViolations, expectToast, loginAs, test } from "../support/test.ts";

test("parcours 10 : depart d'un membre, ses recettes restent", async ({
  page,
  scenario,
  otherPage,
}) => {
  const { space, members } = await scenario("group", {
    spaceName: "Famille",
    members: ["MEMBER", "MODERATOR"],
  });
  const [tom, ines] = members;
  if (!tom || !ines) throw new Error("scenario group: members missing");
  await loginAs(page, tom);
  await createRecipe(page, space.id, { title: "Tarte de Tom" });

  // Tom quitte Famille depuis les reglages : il est prevenu que sa recette reste.
  await page.goto(`/s/${space.id}/settings`);
  await expectNoA11yViolations(page);
  await page.getByRole("button", { name: "Quitter Famille" }).click();
  const sheet = page.getByRole("dialog", { name: "Quitter Famille" });
  await expect(sheet.getByText(/La recette que tu as créée dans Famille y reste/)).toBeVisible();
  await expectNoA11yViolations(page);
  await sheet.getByRole("button", { name: "Quitter Famille" }).click();
  await expectToast(page, "Tu as quitté Famille");
  await expect(page).toHaveURL(new RegExp(`/s/${tom.personalSpaceId}/`));

  // Famille a disparu de ses espaces, et son adresse ne lui repond plus.
  await page.getByRole("button", { name: /changer d'espace/ }).click();
  const spaces = page.getByRole("dialog", { name: "Espaces" });
  await expect(spaces.getByText("Créer ou rejoindre")).toBeVisible();
  await expect(spaces.getByText("Famille")).toHaveCount(0);
  await page.goto(`/s/${space.id}/recipes`);
  await expect(page.getByRole("heading", { name: "Espace introuvable" })).toBeVisible();

  // Ines, moderatrice : la recette est toujours la, elle peut la reprendre.
  const inesPage = await otherPage();
  await loginAs(inesPage, ines);
  await inesPage.goto(`/s/${space.id}/recipes`);
  await inesPage.getByRole("article", { name: "Tarte de Tom" }).click();
  await expect(inesPage.getByRole("heading", { name: "Tarte de Tom" })).toBeVisible();
  await expectNoA11yViolations(inesPage);
  await inesPage.getByRole("link", { name: "Modifier" }).click();
  await inesPage.getByLabel("Titre", { exact: true }).fill("Tarte de la famille");
  await inesPage.getByRole("button", { name: "Enregistrer" }).click();
  await expect(inesPage.getByRole("heading", { name: "Tarte de la famille" })).toBeVisible();

  // Tom n'est plus dans les membres.
  await inesPage.goto(`/s/${space.id}/members`);
  await expect(inesPage.getByRole("main").getByText("2 membres", { exact: true })).toBeVisible();
  await expect(inesPage.getByRole("listitem", { name: tom.username })).toHaveCount(0);
});
