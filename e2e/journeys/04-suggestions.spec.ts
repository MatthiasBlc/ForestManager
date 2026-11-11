// Parcours 4 : suggestion acceptee (nouvelle revision visible), puis suggestion
// refusee (rien de cree).
import { createRecipe } from "../support/recipes.ts";
import { expect, expectNoA11yViolations, expectToast, loginAs, test } from "../support/test.ts";

test("parcours 4 : une suggestion acceptee, une suggestion refusee", async ({
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
  const recipeUrl = `/s/${space.id}/recipes/${gratin.id}`;

  // Tom propose de cuire plus longtemps.
  const tomPage = await otherPage();
  await loginAs(tomPage, tom);
  await tomPage.goto(`${recipeUrl}/suggest`);
  await tomPage.getByLabel("Un mot pour lea (facultatif)").fill("Plus fondant ainsi");
  await tomPage.getByRole("textbox", { name: "Étape 1" }).fill("Cuire 1 heure.");
  await tomPage.getByRole("button", { name: "Envoyer la suggestion" }).click();
  await expectToast(tomPage, "Suggestion envoyée à lea");

  // Lea la trouve en tete de la liste, lit la comparaison et accepte.
  await page.goto(`/s/${space.id}/recipes`);
  await page.getByRole("link", { name: /1 suggestion à examiner/ }).click();
  await expect(page.getByRole("heading", { name: "Gratin dauphinois" })).toBeVisible();
  await expect(page.getByText("« Plus fondant ainsi »")).toBeVisible();
  const changes = page.getByRole("table", { name: "Changements proposés" });
  await expect(changes).toContainText("Cuire 45 minutes.");
  await expect(changes).toContainText("Cuire 1 heure.");
  await expectNoA11yViolations(page);
  await page.getByRole("button", { name: "Accepter la suggestion" }).click();
  await expectToast(page, "Suggestion acceptée : révision 2");

  // Nouvelle revision visible, sur la recette et dans son historique.
  await expect(page).toHaveURL(new RegExp(`${recipeUrl}$`));
  await expect(page.getByText(/· révision 2$/)).toBeVisible();
  await expect(page.getByText("Cuire 1 heure.")).toBeVisible();
  await page.goto(`${recipeUrl}/history`);
  const revisions = page.getByRole("list", { name: "Révisions de Gratin dauphinois" });
  await expect(revisions.getByRole("listitem")).toHaveCount(2);
  await expectNoA11yViolations(page);

  // Seconde suggestion de Tom, refusee avec un mot.
  await tomPage.goto(`${recipeUrl}/suggest`);
  await tomPage.getByRole("textbox", { name: "Étape 1" }).fill("Cuire 2 heures.");
  await tomPage.getByRole("button", { name: "Envoyer la suggestion" }).click();
  await expectToast(tomPage, "Suggestion envoyée à lea");

  await page.goto(recipeUrl);
  await page.getByRole("link", { name: /Suggestion de/ }).click();
  await page.getByRole("button", { name: "Refuser" }).click();
  const refusal = page.getByRole("dialog", { name: "Refuser la suggestion" });
  await refusal.getByLabel(/Un mot pour .* \(facultatif\)/).fill("Trop cuit pour moi");
  await expectNoA11yViolations(page);
  await refusal.getByRole("button", { name: "Refuser" }).click();
  await expectToast(page, "Suggestion refusée");

  // Rien de cree : la recette reste a la revision 2, l'historique a deux lignes.
  await expect(page.getByText(/· révision 2$/)).toBeVisible();
  await expect(page.getByText("Cuire 1 heure.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Suggestion de/ })).toHaveCount(0);
  await page.goto(`${recipeUrl}/history`);
  await expect(revisions.getByRole("listitem")).toHaveCount(2);

  // Tom apprend le refus et lit le mot de Lea ; ses changements ne sont pas perdus.
  await tomPage.goto(recipeUrl);
  await tomPage.getByRole("link", { name: /Ta suggestion a été refusée/ }).click();
  await expect(
    tomPage.getByText("lea a refusé ta suggestion sur Gratin dauphinois.")
  ).toBeVisible();
  await expect(tomPage.getByText("« Trop cuit pour moi »")).toBeVisible();
  await expect(tomPage.getByRole("button", { name: "En faire mon adaptation" })).toBeVisible();
  await expectNoA11yViolations(tomPage);
});
