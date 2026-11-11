// Parcours 12 : hors ligne. Ouvrir une recette et le planning, couper le
// reseau, recharger : tout reste lisible (coquille servie par le service worker,
// donnees relues de l'appareil), les boutons de modification sont desactives
// avec le bandeau "Hors ligne" [D35, D106].
import { createRecipe } from "../support/recipes.ts";
import {
  apiCall,
  expect,
  expectNoA11yViolations,
  loginAs,
  test,
  waitForOfflineCopy,
} from "../support/test.ts";

const OFFLINE = /^Hors ligne\. Tu consultes la dernière version enregistrée/;

test("parcours 12 : recette et planning lisibles hors ligne, ecritures desactivees", async ({
  page,
  scenario,
}) => {
  const { owner: lea, space } = await scenario("group", {
    spaceName: "Famille",
    ownerName: "lea",
    members: [],
    modules: ["meal-plan"],
  });
  await loginAs(page, lea);
  const gratin = await createRecipe(page, space.id, {
    title: "Gratin dauphinois",
    steps: ["Cuire 45 minutes."],
  });
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
  const meal = await apiCall(page, "PUT", `/spaces/${space.id}/meal-plan/meals/${today}/DINNER`, {
    kind: "RECIPE",
    recipeId: gratin.id,
  });
  expect(meal.status(), await meal.text()).toBe(200);
  const recipeUrl = `/s/${space.id}/recipes/${gratin.id}`;
  const planningUrl = `/s/${space.id}/meal-plan`;

  // Service worker installe, puis page rechargee pour qu'il la controle.
  await page.goto(recipeUrl);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);

  // En ligne : la recette puis le planning sont lus (et gardes sur l'appareil).
  await expect(page.getByRole("heading", { name: "Gratin dauphinois" })).toBeVisible();
  // La copie sur l'appareil s'ecrit au plus une fois par seconde : on la laisse finir.
  await waitForOfflineCopy(page, '"me"', `"detail","${gratin.id}"`);
  await page.goto(planningUrl);
  const slot = page.getByRole("button", { name: /: Gratin dauphinois/ }).first();
  await expect(slot).toBeVisible();
  await expect(page.getByText(OFFLINE)).toHaveCount(0);
  await waitForOfflineCopy(page, '"meals"');

  // Reseau coupe, planning recharge : lisible, bandeau, repas non modifiable.
  await page.context().setOffline(true);
  await page.reload();
  await expect(page.getByText(OFFLINE)).toBeVisible();
  await expect(slot).toBeVisible();
  await expectNoA11yViolations(page);
  await slot.click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("button", { name: "Enregistrer" })).toBeDisabled();
  await expect(sheet.getByRole("button", { name: "Vider le repas" })).toBeDisabled();
  await page.keyboard.press("Escape");

  // La recette, ouverte par son adresse sans reseau.
  await page.goto(recipeUrl);
  await expect(page.getByText(OFFLINE)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Gratin dauphinois" })).toBeVisible();
  await expect(page.getByText("Cuire 45 minutes.")).toBeVisible();
  const edit = page.getByRole("button", { name: "Modifier" });
  await expect(edit).toBeDisabled();
  await expect(edit).toHaveAccessibleDescription(OFFLINE);
  await expectNoA11yViolations(page);

  // Le reseau revient : le bandeau part, la modification se rouvre.
  await page.context().setOffline(false);
  await expect(page.getByText(OFFLINE)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Modifier" })).toBeVisible();
});
