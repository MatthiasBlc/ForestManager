// Parcours 21 : liste de courses [D228, D231]. Lea remplit la liste depuis le planning
// (apercu a cocher, doublons additionnes), ajoute un article a la main ; Sam, dans
// un autre navigateur, voit la liste suivre en direct et coche ; Lea retire les
// achetes, annule, puis retire pour de bon. Date du navigateur de Lea figee au mardi
// 9 mars 2027 : la periode proposee (demain a la fin de la semaine) est connue.
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

/** Attente bornee du temps reel : sans rechargement, l'autre membre suit en 5 s. */
const LIVE = { timeout: 5_000 };

const article = (page: Page, name: string) => page.getByRole("checkbox", { name, exact: true });

test("parcours 21 : depuis le planning, cocher a deux en direct, retirer les achetes", async ({
  page,
  scenario,
  otherPage,
}) => {
  const {
    owner: lea,
    space,
    members: [sam],
  } = await scenario("group", {
    spaceName: "Famille",
    ownerName: "lea",
    members: ["MEMBER"],
    modules: ["meal-plan", "shopping"],
  });
  if (!sam) throw new Error("scenario group: member missing");
  await loginAs(page, lea);
  const curry = await createRecipe(page, space.id, {
    title: "Curry de lentilles",
    ingredients: [
      [200, "g", "Lentilles corail"],
      [2, "piece", "Oignon"],
      [400, "g", "Lait de coco"],
    ],
  });
  const soup = await createRecipe(page, space.id, {
    title: "Soupe à l'oignon",
    ingredients: [[1, "piece", "Oignon"]],
  });
  for (const [date, time, recipe] of [
    ["2027-03-10", "LUNCH", curry],
    ["2027-03-11", "DINNER", soup],
  ] as const) {
    const meal = await apiCall(page, "PUT", `/spaces/${space.id}/meal-plan/meals/${date}/${time}`, {
      kind: "RECIPE",
      recipeId: recipe.id,
    });
    expect(meal.status(), await meal.text()).toBe(200);
  }
  await page.clock.setFixedTime(new Date("2027-03-09T10:00:00+01:00"));
  const listUrl = `/s/${space.id}/shopping`;

  // 1. Sam ouvre la liste, vide, et la garde ouverte.
  const samPage = await otherPage();
  await loginAs(samPage, sam);
  await samPage.goto(listUrl);
  await expect(samPage.getByRole("heading", { name: "La liste est vide" })).toBeVisible();

  // 2. Lea ouvre Courses par l'onglet, puis "Depuis le planning" : periode de demain
  // a dimanche, ingredients additionnes et tous coches.
  await page.goto(`/s/${space.id}/meal-plan`);
  await page.getByRole("link", { name: "Courses" }).click();
  await expect(page).toHaveURL(new RegExp(`${listUrl}$`));
  await expect(page.getByRole("heading", { name: "Courses", level: 1 })).toBeVisible();
  await expect(page.getByText("0 à acheter")).toBeVisible();
  await expectNoA11yViolations(page);
  await page.getByRole("button", { name: "Depuis le planning" }).click();
  const sheet = page.getByRole("dialog", { name: "Depuis le planning" });
  await expect(sheet.getByLabel("Du")).toHaveValue("2027-03-10");
  await expect(sheet.getByLabel("Au")).toHaveValue("2027-03-14");
  // Deux recettes, une ligne : 2 + 1 oignons.
  const onion = sheet.getByRole("listitem").filter({ has: article(page, "oignon") });
  await expect(onion).toContainText("Curry de lentilles, Soupe à l'oignon");
  await expect(onion).toContainText("3 pièces");
  for (const name of ["lentilles corail", "oignon", "lait de coco"]) {
    await expect(article(page, name)).toBeChecked();
  }
  await expectNoA11yViolations(page);

  // 3. Le lait de coco est deja la : decoche, deux articles ajoutes.
  await article(page, "lait de coco").click();
  await sheet.getByRole("button", { name: "Ajouter 2 articles" }).click();
  await expectToast(page, "2 articles ajoutés");
  await expect(sheet).toBeHidden();
  await expect(page.getByText("2 à acheter")).toBeVisible();
  await expect(article(page, "lait de coco")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Détail de oignon / })).toHaveAccessibleName(
    "Détail de oignon pour : Curry de lentilles, Soupe à l'oignon 3 pièces"
  );

  // 4. Un article a la main, le texte tel quel ; le champ reste pret pour le suivant.
  const add = page.getByRole("combobox", { name: "Ajouter un article" });
  await add.fill("Piles");
  await add.press("Enter");
  await expect(article(page, "Piles")).toBeVisible();
  await expect(add).toHaveValue("");
  await expect(add).toBeFocused();
  await expect(page.getByText("3 à acheter")).toBeVisible();
  await expectNoA11yViolations(page);

  // 5. Sans recharger, Sam voit les trois articles, et coche les piles : Lea le voit.
  for (const name of ["lentilles corail", "oignon", "Piles"]) {
    await expect(article(samPage, name)).toBeVisible(LIVE);
  }
  await expect(samPage.getByText("3 à acheter")).toBeVisible();
  await article(samPage, "Piles").click();
  await expect(article(samPage, "Piles")).toBeChecked();
  await expect(article(page, "Piles")).toBeChecked(LIVE);
  await expect(page.getByText("2 à acheter")).toBeVisible();
  await expectNoA11yViolations(samPage);

  // 6. Lea coche l'oignon, puis retire les achetes ; Annuler les remet, cochés.
  await article(page, "oignon").click();
  await expect(article(page, "oignon")).toBeChecked();
  await page.getByRole("button", { name: "Menu de la liste" }).click();
  await page.getByRole("menuitem", { name: "Retirer les achetés (2)" }).click();
  await expectToast(page, "2 articles retirés");
  await expect(article(page, "Piles")).toHaveCount(0);
  await expect(article(page, "oignon")).toHaveCount(0);
  await page
    .getByRole("region", { name: /^Notifications/ })
    .getByRole("button", { name: "Annuler" })
    .click();
  await expect(article(page, "Piles")).toBeChecked();
  await expect(article(page, "oignon")).toBeChecked();
  await expect(article(samPage, "oignon")).toBeChecked(LIVE);

  // 7. Retires pour de bon : il reste les lentilles, chez Lea comme chez Sam,
  // et apres rechargement.
  await page.getByRole("button", { name: "Menu de la liste" }).click();
  await page.getByRole("menuitem", { name: "Retirer les achetés (2)" }).click();
  await expectToast(page, "2 articles retirés");
  for (const reload of [false, true]) {
    if (reload) await page.reload();
    await expect(page.getByText("1 à acheter")).toBeVisible();
    await expect(article(page, "lentilles corail")).not.toBeChecked();
    await expect(article(page, "oignon")).toHaveCount(0);
  }
  await expect(article(samPage, "Piles")).toHaveCount(0, LIVE);
  await expect(samPage.getByText("1 à acheter")).toBeVisible();
});
