// Parcours 5 : adapter une recette pour un autre espace, modifier l'adaptation,
// l'original n'a pas bouge ; l'original change, le badge apparait, la
// comparaison s'ouvre.
import { createRecipe } from "../support/recipes.ts";
import { expect, expectNoA11yViolations, expectToast, loginAs, test } from "../support/test.ts";

test("parcours 5 : adaptation, original modifie, comparaison", async ({
  page,
  scenario,
  otherPage,
}) => {
  const {
    owner: lea,
    space,
    members: [tom],
  } = await scenario("group", { spaceName: "Famille", ownerName: "lea", members: ["MEMBER"] });
  if (!tom) throw new Error("scenario group: member missing");
  await loginAs(page, lea);
  const gratin = await createRecipe(page, space.id, {
    title: "Gratin dauphinois",
    steps: ["Cuire 45 minutes."],
  });
  const originalUrl = `/s/${space.id}/recipes/${gratin.id}`;

  // Tom adapte la recette de Lea pour son espace perso.
  const tomPage = await otherPage();
  await loginAs(tomPage, tom);
  await tomPage.goto(originalUrl);
  await tomPage.getByRole("button", { name: "Plus d'actions" }).click();
  await tomPage.getByRole("menuitem", { name: "Adapter pour un espace" }).click();
  const adapt = tomPage.getByRole("dialog", { name: "Adapter pour un espace" });
  await expect(adapt.getByText("par lea · Famille")).toBeVisible();
  await adapt
    .getByRole("group", { name: "Espace de l'adaptation" })
    .getByRole("button", { name: "Espace perso" })
    .click();
  await expectNoA11yViolations(tomPage);
  await adapt.getByRole("button", { name: "Créer et modifier l'adaptation" }).click();
  await expectToast(tomPage, "Adaptation créée dans ton espace perso");

  // L'editeur de l'adaptation s'ouvre : Tom change la cuisson.
  await expect(tomPage).toHaveURL(
    new RegExp(`/s/${tom.personalSpaceId}/recipes/[0-9a-f-]{36}/edit$`)
  );
  await tomPage.getByRole("textbox", { name: "Étape 1" }).fill("Cuire 1 heure, à couvert.");
  await tomPage.getByRole("button", { name: "Enregistrer la révision 2" }).click();
  await expect(tomPage.getByText("Cuire 1 heure, à couvert.")).toBeVisible();
  await expect(tomPage.getByText("Adaptée de Gratin dauphinois · lea (Famille)")).toBeVisible();
  await expect(tomPage.getByRole("link", { name: /Original modifié/ })).toHaveCount(0);
  await expectNoA11yViolations(tomPage);
  const adaptationUrl = new URL(tomPage.url()).pathname;

  // L'original n'a pas bouge.
  await page.goto(originalUrl);
  await expect(page.getByText(/· révision 1$/)).toBeVisible();
  await expect(page.getByText("Cuire 45 minutes.")).toBeVisible();

  // Lea modifie l'original.
  await page.getByRole("link", { name: "Modifier" }).click();
  await page.getByRole("textbox", { name: "Étape 1" }).fill("Cuire 50 minutes.");
  await page.getByRole("button", { name: "Enregistrer la révision 2" }).click();
  await expect(page.getByText("Cuire 50 minutes.")).toBeVisible();

  // Chez Tom, le badge apparait sur l'adaptation et ouvre la comparaison.
  await tomPage.goto(adaptationUrl);
  await expect(tomPage.getByText("Cuire 1 heure, à couvert.")).toBeVisible();
  await expectNoA11yViolations(tomPage);
  await tomPage.getByRole("link", { name: /Original modifié/ }).click();
  await expect(tomPage).toHaveURL(new RegExp(`${adaptationUrl}/compare$`));
  const theirs = tomPage.getByRole("table", { name: "Changements de l'original" });
  await expect(theirs).toContainText("Cuire 45 minutes.");
  await expect(theirs).toContainText("Cuire 50 minutes.");
  const mine = tomPage.getByRole("table", { name: /^Changements de / }).last();
  await expect(mine).toContainText("Cuire 1 heure, à couvert.");
  await expectNoA11yViolations(tomPage);

  // Marquer comme vu : le badge disparait, l'adaptation n'a pas change.
  await tomPage.getByRole("button", { name: "Marquer comme vu" }).click();
  await expectToast(tomPage, "Marqué comme vu");
  await expect(tomPage.getByText("Cuire 1 heure, à couvert.")).toBeVisible();
  await expect(tomPage.getByRole("link", { name: /Original modifié/ })).toHaveCount(0);
});
