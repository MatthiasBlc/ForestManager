// Parcours 14 : clavier seul et palette Ctrl K (23-Plan-C6b S4). Desktop : aucun
// clic, `page.keyboard` seulement. Mobile : la palette plein ecran par la loupe.
// Puis la reprise (D60) : `/` rouvre le dernier ecran.
import type { Locator, Page } from "@playwright/test";

import { createRecipe } from "../support/recipes.ts";
import {
  apiCall,
  expect,
  expectNoA11yViolations,
  loginAs,
  test,
  type Scenario,
} from "../support/test.ts";

/** Mardi de la semaine courante, en date locale de Paris (comme le navigateur). */
function tuesdayOfThisWeek(): string {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
  const date = new Date(`${today}T00:00:00Z`);
  const fromMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - fromMonday + 1);
  return date.toISOString().slice(0, 10);
}

/** Donnees du parcours : Famille (Recettes et Planning), un repas mardi midi, une tarte perso. */
async function setUp(page: Page, scenario: Scenario) {
  const { owner: lea, space } = await scenario("group", {
    spaceName: "Famille",
    ownerName: "lea",
    members: [],
    modules: ["meal-plan"],
  });
  await loginAs(page, lea);
  const gratin = await createRecipe(page, space.id, {
    title: "Gratin dauphinois",
    ingredients: [
      [1, "kg", "Pomme de terre"],
      [200, "g", "Crème"],
    ],
  });
  await createRecipe(page, space.id, {
    title: "Soupe de potiron",
    ingredients: [[1, "kg", "Potiron"]],
  });
  await createRecipe(page, lea.personalSpaceId, {
    title: "Tarte aux pommes",
    ingredients: [[200, "g", "Farine"]],
  });
  const tuesday = tuesdayOfThisWeek();
  const meal = await apiCall(page, "PUT", `/spaces/${space.id}/meal-plan/meals/${tuesday}/LUNCH`, {
    kind: "RECIPE",
    recipeId: gratin.id,
  });
  expect(meal.status(), await meal.text()).toBe(200);
  return { lea, space, tuesday };
}

/** Tab jusqu'a l'element voulu (au plus 40 arrets). */
async function tabTo(page: Page, target: Locator): Promise<void> {
  for (let i = 0; i < 40; i += 1) {
    if (await target.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error(`focus jamais pose sur ${target.toString()}`);
}

/** Zone et visibilite du focus de l'element actif. */
function focusState(page: Page) {
  return page.evaluate(() => {
    const element = document.activeElement;
    if (!(element instanceof HTMLElement)) return null;
    const landmark = element.closest("nav, aside, header, main");
    const zone = landmark
      ? `${landmark.tagName.toLowerCase()} ${landmark.getAttribute("aria-label") ?? ""}`.trim()
      : "hors repere";
    const style = getComputedStyle(element);
    return {
      zone,
      name: element.getAttribute("aria-label") ?? element.textContent.trim().slice(0, 30),
      focusVisible: element.matches(":focus-visible"),
      ring: style.outlineStyle !== "none" || style.boxShadow !== "none",
    };
  });
}

const palette = (page: Page) => page.getByRole("dialog", { name: "Recherche" });

test("parcours 14 : clavier seul et palette Ctrl K @desktop", async ({ page, scenario }, info) => {
  test.skip(info.project.name !== "desktop", "partie mobile dans le test suivant");
  const { space, tuesday } = await setUp(page, scenario);

  // 1. Premier passage : l'accueil de l'espace perso ; Tab suit l'ordre visuel, focus visible.
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const stops = [];
  for (let i = 0; i < 14; i += 1) {
    await page.keyboard.press("Tab");
    stops.push(await focusState(page));
  }
  // Ordre visuel : rail, barre des modules, en-tete, contenu (sans retour en arriere).
  const zones = stops.map((stop) => stop?.zone).filter((zone, i, all) => zone !== all[i - 1]);
  expect(zones).toEqual(["nav Espaces", "aside Modules de l'espace", "header", "main"]);
  for (const stop of stops) {
    expect(stop?.focusVisible, `focus visible sur ${String(stop?.name)}`).toBe(true);
    expect(stop?.ring, `contour sur ${String(stop?.name)}`).toBe(true);
  }

  // 2. Ctrl K : focus dans le champ, "Actions" en tete ("Recemment ouvertes" suit, vide
  // et donc masque au premier passage) ; Echap rend le focus.
  const origin = await page.evaluate(() => document.activeElement?.outerHTML);
  await page.keyboard.press("Control+k");
  const search = page.getByRole("combobox", { name: "Rechercher" });
  await expect(search).toBeFocused();
  const groups = palette(page).getByRole("listbox");
  await expect(groups.first()).toHaveAccessibleName("Actions");
  await page.keyboard.press("Escape");
  await expect(search).toBeHidden();
  expect(await page.evaluate(() => document.activeElement?.outerHTML)).toBe(origin);

  // 3. Famille par le rail, puis "pom" : la tarte perso et l'ingredient ; Entree sur l'ingredient.
  await tabTo(
    page,
    page.getByRole("navigation", { name: "Espaces" }).getByRole("button", { name: "Famille" })
  );
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/s/${space.id}/`));
  await page.keyboard.press("Control+k");
  await page.keyboard.type("pom");
  const recipes = palette(page).getByRole("listbox", { name: "Recettes" });
  await expect(recipes.getByRole("option", { name: /^Tarte aux pommes lea/ })).toBeVisible();
  const ingredients = palette(page).getByRole("listbox", { name: "Ingrédients" });
  const potato = ingredients.getByRole("option", { name: /^Pomme de terre 1 recette · Famille/ });
  await expect(potato).toBeVisible();
  await expectNoA11yViolations(page);
  for (let i = 0; i < 10; i += 1) {
    if ((await potato.getAttribute("aria-selected")) === "true") break;
    await page.keyboard.press("ArrowDown");
  }
  await expect(potato).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/s/${space.id}/recipes\\?ingredient=`));
  await expect(page.getByRole("button", { name: /Pomme de terre/ })).toHaveText(
    "Avec Pomme de terre"
  );
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByRole("article", { name: "Gratin dauphinois" })).toBeVisible();
  await expectNoA11yViolations(page);

  // 4. "gratin" : le repas de mardi midi ; Entree ouvre la semaine sur ce jour.
  await page.keyboard.press("Control+k");
  await page.keyboard.type("gratin");
  const meals = palette(page).getByRole("listbox", { name: "Planning" });
  await expect(meals.getByRole("option", { name: /, midi : Gratin dauphinois/ })).toBeVisible();
  for (let i = 0; i < 10; i += 1) {
    if ((await meals.getByRole("option").first().getAttribute("aria-selected")) === "true") break;
    await page.keyboard.press("ArrowDown");
  }
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/s/${space.id}/meal-plan\\?day=${tuesday}`));
  await expect(page.getByRole("link", { name: /, midi : Gratin dauphinois$/ })).toBeVisible();

  // 5. "generer" : l'action ouvre F-GENERER ; Echap la ferme et rend le focus.
  await page.keyboard.press("Control+k");
  await page.keyboard.type("generer");
  const action = palette(page).getByRole("option", { name: "Générer le planning" });
  await expect(action).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  const sheet = page.getByRole("dialog", { name: "Générer le planning" });
  await expect(sheet).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(page.locator("body")).not.toBeFocused();

  // 6. "zzz" : rien trouve, sans erreur (la console est surveillee par le socle).
  await page.keyboard.press("Control+k");
  await page.keyboard.type("zzz");
  await expect(palette(page).getByText("Rien trouvé pour « zzz »")).toBeVisible();
  await page.keyboard.press("Escape");
});

test("parcours 14 : palette plein ecran sur mobile, puis reprise", async ({
  page,
  scenario,
}, info) => {
  test.skip(info.project.name !== "mobile", "partie desktop dans le test precedent");
  const { space } = await setUp(page, scenario);

  // La loupe ouvre la palette plein ecran ; "soupe" puis toucher le resultat.
  await page.goto(`/s/${space.id}/recipes`);
  await page.getByRole("button", { name: "Rechercher" }).click();
  await expect(palette(page).getByRole("button", { name: "Fermer" })).toBeVisible();
  await page.getByRole("combobox", { name: "Rechercher" }).fill("soupe");
  await palette(page)
    .getByRole("option", { name: /^Soupe de potiron/ })
    .click();
  await expect(page.getByRole("heading", { name: "Soupe de potiron" })).toBeVisible();

  // Rouverte : la soupe est dans "Recemment ouvertes".
  await page.getByRole("button", { name: "Retour" }).click();
  await page.getByRole("button", { name: "Rechercher" }).click();
  await expect(
    palette(page)
      .getByRole("listbox", { name: "Récemment ouvertes" })
      .getByRole("option", { name: /^Soupe de potiron Famille/ })
  ).toBeVisible();
  await expectNoA11yViolations(page);
  await palette(page).getByRole("button", { name: "Fermer" }).click();

  // Reprise (D60) : les membres de Famille, puis `/` rouvre Famille sur Membres.
  await page.goto(`/s/${space.id}/members`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.goto("/");
  await expect(page).toHaveURL(new RegExp(`/s/${space.id}/members$`));
});
