// Parcours 3 : partager une recette perso dans un espace ; un membre la voit,
// ne peut pas la modifier, peut la suggerer.
import { createRecipe } from "../support/recipes.ts";
import { expect, expectNoA11yViolations, expectToast, loginAs, test } from "../support/test.ts";

test("parcours 3 : recette perso partagee, vue par un membre qui peut la suggerer", async ({
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
  const tarte = await createRecipe(page, lea.personalSpaceId, {
    title: "Tarte aux pommes",
    steps: ["Cuire 30 minutes."],
  });

  // Lea partage sa recette perso dans Famille.
  await page.goto(`/s/${lea.personalSpaceId}/recipes/${tarte.id}`);
  await page.getByRole("button", { name: "Plus d'actions" }).click();
  await page.getByRole("menuitem", { name: "Partager dans un espace" }).click();
  const share = page.getByRole("dialog", { name: "Partager dans tes espaces" });
  await expect(share.getByText("Espace d'origine")).toBeVisible();
  await share.getByRole("switch", { name: "Famille" }).click();
  await expectNoA11yViolations(page);
  await share.getByRole("button", { name: "Enregistrer" }).click();
  await expectToast(page, "Partagée dans Famille");

  // Tom, membre de Famille, la voit dans la liste, avec son espace d'origine.
  const tomPage = await otherPage();
  await loginAs(tomPage, tom);
  await tomPage.goto(`/s/${space.id}/recipes`);
  await tomPage.getByRole("article", { name: "Tarte aux pommes" }).click();
  await expect(tomPage.getByRole("heading", { name: "Tarte aux pommes" })).toBeVisible();
  await expect(tomPage.getByText(/^par lea · /)).toBeVisible();
  await expectNoA11yViolations(tomPage);

  // Il ne peut pas la modifier : ni bouton, ni action, ni ecran d'edition.
  await expect(tomPage.getByRole("link", { name: "Modifier" })).toHaveCount(0);
  await tomPage.getByRole("button", { name: "Plus d'actions" }).click();
  await expect(tomPage.getByRole("menuitem", { name: "Supprimer" })).toHaveCount(0);
  await expectNoA11yViolations(tomPage, '[role="menu"]');

  // Il peut la suggerer : l'editeur s'ouvre en mode suggestion, l'envoi passe.
  await tomPage.getByRole("menuitem", { name: "Suggérer une modification" }).click();
  await expect(tomPage.getByText(/Mode suggestion : lea verra tes changements/)).toBeVisible();
  await tomPage.getByRole("textbox", { name: "Étape 1" }).fill("Cuire 40 minutes.");
  await expectNoA11yViolations(tomPage);
  await tomPage.getByRole("button", { name: "Envoyer la suggestion" }).click();
  await expectToast(tomPage, "Suggestion envoyée à lea");
  await expect(tomPage.getByRole("link", { name: /Ta suggestion est en attente/ })).toBeVisible();
  // La recette, elle, n'a pas change.
  await expect(tomPage.getByText("Cuire 30 minutes.")).toBeVisible();

  // L'ecran d'edition lui est ferme, meme par son adresse.
  await tomPage.goto(`/s/${space.id}/recipes/${tarte.id}/edit`);
  await expect(tomPage.getByLabel("Titre", { exact: true })).toHaveCount(0);
  await expect(tomPage.getByRole("heading", { name: /introuvable/i })).toBeVisible();
});
