// Parcours 16 : une notification arrive en direct dans l'autre navigateur, s'ouvre
// et se lit (22-Plan-C6 S4). Deux contextes, vrai flux SSE a travers nginx.
import type { Page } from "@playwright/test";

import { createRecipe } from "../support/recipes.ts";
import {
  apiCall,
  expect,
  expectNoA11yViolations,
  expectToast,
  loginAs,
  test,
} from "../support/test.ts";

/** Attente bornee du temps reel : sans rechargement, la cloche suit en 5 s. */
const LIVE = { timeout: 5_000 };

const bell = (page: Page) => page.getByRole("button", { name: /^Notifications/ });

async function suggest(page: Page, recipeUrl: string, step: string): Promise<void> {
  await page.goto(`${recipeUrl}/suggest`);
  await page.getByRole("textbox", { name: "Étape 1" }).fill(step);
  await page.getByRole("button", { name: "Envoyer la suggestion" }).click();
  await expectToast(page, "Suggestion envoyée à lea");
}

async function refuse(page: Page, recipeUrl: string): Promise<void> {
  await page.goto(recipeUrl);
  await page.getByRole("link", { name: /Suggestion de/ }).click();
  await page.getByRole("button", { name: "Refuser" }).click();
  await page
    .getByRole("dialog", { name: "Refuser la suggestion" })
    .getByRole("button", { name: "Refuser" })
    .click();
  await expectToast(page, "Suggestion refusée");
}

test("parcours 16 : notification en direct, ouverte, lue, preferences, depart", async ({
  page,
  scenario,
  otherPage,
}) => {
  const {
    owner: lea,
    space,
    members: [sam],
  } = await scenario("group", { spaceName: "Famille", ownerName: "lea", members: ["MEMBER"] });
  if (!sam) throw new Error("scenario group: member missing");
  await loginAs(page, lea);
  const gratin = await createRecipe(page, space.id, {
    title: "Gratin",
    steps: ["Cuire 45 minutes."],
  });
  const recipeUrl = `/s/${space.id}/recipes/${gratin.id}`;
  const samPage = await otherPage();
  await loginAs(samPage, sam);
  // Sam a ete prevenu de la recette ajoutee : il part d'une cloche vide.
  expect((await apiCall(samPage, "POST", "/me/notifications/read-all")).status()).toBe(204);

  // 1. Lea ouvre Famille, cloche sans compteur ; Sam ouvre "Gratin".
  await page.goto(`/s/${space.id}/recipes`);
  await expect(bell(page)).toHaveAccessibleName("Notifications");
  await samPage.goto(recipeUrl);
  await expect(samPage.getByRole("heading", { name: "Gratin" })).toBeVisible();

  // 2 et 3. Sam propose une modification : la cloche de Lea s'allume sans rechargement.
  await suggest(samPage, recipeUrl, "Cuire 1 heure.");
  await expect(bell(page)).toHaveAccessibleName("Notifications, 1 non lues", LIVE);

  // 4. E-NOTIFICATIONS : sous "Aujourd'hui", non lue.
  await bell(page).click();
  const today = page.getByRole("region", { name: "Aujourd'hui" });
  const notification = today.getByRole("link", {
    name: new RegExp(`${sam.username} propose une modification de « Gratin »\\.`),
  });
  await expect(notification).toBeVisible();
  await expect(notification.getByLabel("Non lue")).toBeVisible();
  await expectNoA11yViolations(page);

  // 5. Toucher l'ouvre (la recette, qui porte la suggestion) ; au retour elle est lue.
  await notification.click();
  await expect(page).toHaveURL(new RegExp(`${recipeUrl}$`));
  await expect(page.getByRole("link", { name: /Suggestion de/ })).toBeVisible();
  await page.goBack();
  await expect(notification).toBeVisible();
  await expect(notification.getByLabel("Non lue")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Tout marquer comme lu" })).toBeDisabled();
  await page.goto(`/s/${space.id}/recipes`);
  await expect(bell(page)).toHaveAccessibleName("Notifications");

  // 6. Lea refuse : la cloche de Sam (liste des recettes) s'allume, la notification
  // ouvre la recette.
  await samPage.goto(`/s/${space.id}/recipes`);
  await expect(bell(samPage)).toHaveAccessibleName("Notifications");
  await refuse(page, recipeUrl);
  await expect(bell(samPage)).toHaveAccessibleName("Notifications, 1 non lues", LIVE);
  await bell(samPage).click();
  await samPage.getByRole("link", { name: /lea a refusé ta suggestion sur « Gratin »\./ }).click();
  await expect(samPage).toHaveURL(new RegExp(`${recipeUrl}$`));
  await expect(samPage.getByRole("heading", { name: "Gratin" })).toBeVisible();

  // 7. Sam coupe "Suggestions et partages" pour Famille ; le refus suivant ne le notifie pas.
  await samPage.goto("/profile/notifications");
  await samPage
    .getByRole("navigation", { name: "Préférences par espace" })
    .getByRole("button", { name: /Famille/ })
    .click();
  const prefs = samPage.getByRole("dialog", { name: "Famille" });
  await prefs.getByRole("radio", { name: "Personnalisé" }).click();
  await prefs.getByRole("switch", { name: /^Suggestions et partages/ }).click();
  await expectNoA11yViolations(samPage);
  await prefs.getByRole("button", { name: "Enregistrer" }).click();
  await expect(prefs).toBeHidden();
  const famille = samPage
    .getByRole("navigation", { name: "Préférences par espace" })
    .getByRole("button", { name: /Famille/ });
  await expect(famille).toContainText("Personnalisé");
  await expect(famille).not.toContainText("suggestions et partages");
  await suggest(samPage, recipeUrl, "Cuire 2 heures.");
  await refuse(page, recipeUrl);
  // Relu du serveur : aucune notification creee, la cloche reste sans compteur.
  await samPage.goto(`/s/${space.id}/recipes`);
  await expect(samPage.getByRole("article", { name: "Gratin" })).toBeVisible();
  await expect(bell(samPage)).toHaveAccessibleName("Notifications");

  // 8. Sam quitte Famille avec une suggestion en attente : elle tombe avec son depart.
  await suggest(samPage, recipeUrl, "Cuire 3 heures.");
  await samPage.goto(`/s/${space.id}/settings`);
  await samPage.getByRole("button", { name: "Quitter Famille" }).click();
  await samPage
    .getByRole("dialog", { name: "Quitter Famille" })
    .getByRole("button", { name: "Quitter Famille" })
    .click();
  await expectToast(samPage, "Tu as quitté Famille");

  await page.goto(`/s/${space.id}/activity`);
  // En tete du fil, avant l'ajout de la recette.
  await expect(page.getByRole("region", { name: "Aujourd'hui" })).toHaveText(
    new RegExp(`${sam.username} a quitté l'espace\\..*lea a ajouté « Gratin »`)
  );
  await expectNoA11yViolations(page);
  await page.goto("/notifications");
  // Le nom accessible enchaine le texte et l'age : rien entre les deux.
  await expect(
    page.getByRole("link", { name: new RegExp(`${sam.username} a quitté Famille\\. À l'instant`) })
  ).toBeVisible();
  await expect(page.getByText(/en attente/)).toHaveCount(0);
  await page.goto(recipeUrl);
  await expect(page.getByRole("link", { name: /Suggestion de/ })).toHaveCount(0);
});
