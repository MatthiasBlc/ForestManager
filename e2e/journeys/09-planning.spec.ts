// Parcours 9 : remplir le planning a la main, verrouiller un repas, generer le
// reste de la semaine, puis regenerer en remplacant (21-Plan-C5 S4), echanger deux
// repas au doigt et ouvrir une recette [D204]. Date du navigateur figee au mardi
// 9 mars 2027 : la semaine affichee est connue.
import type { Locator, Page } from "@playwright/test";

import { createRecipe } from "../support/recipes.ts";
import { expect, expectNoA11yViolations, expectToast, loginAs, test } from "../support/test.ts";

// Une recette par case : le profil Standard ne repropose pas une recette prevue
// il y a moins de 3 jours, 6 recettes (scenario de depart) laissaient des cases vides.
const RECIPES = [
  "Gratin dauphinois",
  "Soupe de potiron",
  "Curry de lentilles",
  "Poulet rôti",
  "Risotto aux champignons",
  "Quiche lorraine",
  "Lasagnes",
  "Tarte aux poireaux",
  "Chili sin carne",
  "Pot-au-feu",
  "Salade niçoise",
  "Omelette aux herbes",
  "Couscous",
  "Hachis parmentier",
];

/** Cases dont le nom accessible suit `name` : bouton, ou lien pour un repas-recette [D204]. */
const slots = (page: Page, name: RegExp) =>
  page.getByRole("button", { name }).or(page.getByRole("link", { name }));

/** Un repas de la semaine affichee, par son nom accessible ("Mardi 9, midi : ..."). */
const slot = (page: Page, when: string) => slots(page, new RegExp(`^${when} : `));

/** Glisser au doigt : appui long, la case se souleve, puis deplacement (vrais evenements
 * tactiles, Chromium) [D204]. */
async function touchDrag(page: Page, from: Locator, to: Locator) {
  await from.scrollIntoViewIfNeeded();
  const [a, b] = await Promise.all([from.boundingBox(), to.boundingBox()]);
  if (!a || !b) throw new Error("case hors de la page");
  const start = { x: a.x + a.width / 2, y: a.y + a.height / 2 };
  const end = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [start] });
  await expect(from).toHaveAttribute("data-drag-lifted", "");
  for (let step = 1; step <= 8; step += 1) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        {
          x: start.x + ((end.x - start.x) * step) / 8,
          y: start.y + ((end.y - start.y) * step) / 8,
        },
      ],
    });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

test("parcours 9 : planning rempli a la main, verrou, generation", async ({ page, scenario }) => {
  const { owner: lea, space } = await scenario("group", {
    spaceName: "Famille",
    ownerName: "lea",
    members: [],
    modules: ["meal-plan"],
  });
  await loginAs(page, lea);
  for (const title of RECIPES) await createRecipe(page, space.id, { title });
  await page.clock.setFixedTime(new Date("2027-03-09T10:00:00+01:00"));

  // 1. Vue Jour sur aujourd'hui, puis la semaine : 14 cases vides.
  await page.goto(`/s/${space.id}/meal-plan`);
  await expect(page.getByRole("heading", { name: "Mardi 9 mars" })).toBeVisible();
  await expect(slot(page, "Mardi 9, midi")).toHaveAccessibleName(/: Ajouter un repas$/);
  await page.getByRole("button", { name: "Semaine", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Du 8 au 14 mars" })).toBeVisible();
  const empty = page.getByRole("button", { name: /^\S+ \d+, (midi|soir) : Ajouter un repas$/ });
  await expect(empty).toHaveCount(14);
  await expectNoA11yViolations(page);

  // 2. Mardi midi : une recette cherchee puis enregistree.
  await slot(page, "Mardi 9, midi").click();
  let sheet = page.getByRole("dialog", { name: "Mardi 9, midi" });
  await sheet.getByRole("searchbox", { name: "Recette" }).fill("gratin");
  await sheet.getByRole("option", { name: "Gratin dauphinois" }).click();
  await expectNoA11yViolations(page);
  await sheet.getByRole("button", { name: "Enregistrer" }).click();
  await expect(sheet).toBeHidden();
  await expect(slot(page, "Mardi 9, midi")).toHaveAccessibleName(
    "Mardi 9, midi : Gratin dauphinois"
  );

  // 3. Mardi soir : texte libre, 2 portions, verrouille.
  await slot(page, "Mardi 9, soir").click();
  sheet = page.getByRole("dialog", { name: "Mardi 9, soir" });
  await sheet.getByRole("button", { name: "Texte libre" }).click();
  await sheet.getByLabel("Repas", { exact: true }).fill("Restes");
  const servings = sheet.getByRole("group", { name: "Portions" });
  await servings.getByRole("button", { name: "Moins" }).click();
  await servings.getByRole("button", { name: "Moins" }).click();
  await expect(servings.locator("output")).toHaveText("2 pers.");
  await sheet.getByRole("switch", { name: /^Verrouiller/ }).click();
  await sheet.getByRole("button", { name: "Enregistrer" }).click();
  await expect(sheet).toBeHidden();
  const tuesdayDinner = slot(page, "Mardi 9, soir");
  await expect(tuesdayDinner).toHaveAccessibleName("Mardi 9, soir : Restes, 2 pers., verrouillé");
  await expect(tuesdayDinner).toContainText("2 p.");

  // 4. Mercredi midi : "Pas de repas".
  await slot(page, "Mercredi 10, midi").click();
  sheet = page.getByRole("dialog", { name: "Mercredi 10, midi" });
  await sheet.getByRole("button", { name: "Pas de repas" }).click();
  await sheet.getByRole("button", { name: "Enregistrer" }).click();
  await expect(sheet).toBeHidden();
  await expect(slot(page, "Mercredi 10, midi")).toHaveAccessibleName(
    "Mercredi 10, midi : Pas de repas"
  );

  // 5. Generer cette semaine sans remplacer : 11 cases proposees, 3 laissees.
  await page.getByRole("button", { name: "Générer", exact: true }).click();
  sheet = page.getByRole("dialog", { name: "Générer le planning" });
  await expect(sheet.getByRole("radio", { name: /Standard/ })).toBeChecked();
  await expectNoA11yViolations(page);
  await sheet.getByRole("button", { name: "Générer", exact: true }).click();
  sheet = page.getByRole("dialog", { name: "Planning proposé" });
  await expect(sheet.getByText("11 repas proposés sur 11")).toBeVisible();
  await expect(
    sheet.getByText("Laissés tels quels : 1 verrouillé, 1 déjà rempli, 1 « Pas de repas ».")
  ).toBeVisible();
  await expectNoA11yViolations(page);
  await sheet.getByRole("button", { name: "Garder ce planning" }).click();
  await expectToast(page, "11 repas ajoutés au planning");

  // 6. Les 14 cases sont remplies, les trois repas de depart n'ont pas change.
  await expect(empty).toHaveCount(0);
  await expect(slot(page, "Mardi 9, midi")).toHaveAccessibleName(
    "Mardi 9, midi : Gratin dauphinois"
  );
  await expect(tuesdayDinner).toHaveAccessibleName("Mardi 9, soir : Restes, 2 pers., verrouillé");
  await expect(slot(page, "Mercredi 10, midi")).toHaveAccessibleName(
    "Mercredi 10, midi : Pas de repas"
  );
  const planned = page.getByRole("link", {
    name: new RegExp(`^\\S+ \\d+, (midi|soir) : (${RECIPES.join("|")})$`),
  });
  await expect(planned).toHaveCount(12);

  // 7. Regenerer en remplacant : le repas verrouille et "Pas de repas" restent.
  await page.getByRole("button", { name: "Générer", exact: true }).click();
  sheet = page.getByRole("dialog", { name: "Générer le planning" });
  await sheet.getByRole("switch", { name: /^Remplacer les repas non verrouillés/ }).click();
  await sheet.getByRole("button", { name: "Générer", exact: true }).click();
  sheet = page.getByRole("dialog", { name: "Planning proposé" });
  await expect(sheet.getByText("12 repas proposés sur 12")).toBeVisible();
  await expect(
    sheet.getByText("Laissés tels quels : 1 verrouillé, 1 « Pas de repas ».")
  ).toBeVisible();
  await sheet.getByRole("button", { name: "Garder ce planning" }).click();
  await expectToast(page, "12 repas ajoutés au planning");
  await expect(tuesdayDinner).toHaveAccessibleName("Mardi 9, soir : Restes, 2 pers., verrouillé");
  await expect(slot(page, "Mercredi 10, midi")).toHaveAccessibleName(
    "Mercredi 10, midi : Pas de repas"
  );

  // 8. Rechargement : le planning garde est relu du serveur tel quel.
  const every = slots(page, /^\S+ \d+, (midi|soir) : /);
  const before = await every.allTextContents();
  await page.reload();
  await page.getByRole("button", { name: "Semaine", exact: true }).click();
  await expect(planned).toHaveCount(12);
  await expect(every).toHaveText(before);
  await expect(tuesdayDinner).toHaveAccessibleName("Mardi 9, soir : Restes, 2 pers., verrouillé");

  // 9. Appui long sur "Pas de repas" de mercredi midi, glisse sur jeudi soir : les deux
  // repas s'echangent, sans ouvrir F-REPAS, et le serveur le garde [D204].
  const thursday = slot(page, "Jeudi 11, soir");
  const moved = ((await thursday.getAttribute("aria-label")) ?? "").split(" : ")[1] ?? "";
  await touchDrag(page, slot(page, "Mercredi 10, midi"), thursday);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  for (const reload of [false, true]) {
    if (reload) {
      await page.reload();
      await page.getByRole("button", { name: "Semaine", exact: true }).click();
    }
    await expect(slot(page, "Jeudi 11, soir")).toHaveAccessibleName(
      "Jeudi 11, soir : Pas de repas"
    );
    await expect(slot(page, "Mercredi 10, midi")).toHaveAccessibleName(
      `Mercredi 10, midi : ${moved}`
    );
  }

  // 10. Toucher un repas-recette ouvre la recette [D204].
  const first = planned.first();
  const title = ((await first.getAttribute("aria-label")) ?? "").split(" : ")[1] ?? "";
  await first.click();
  await expect(page).toHaveURL(new RegExp(`/s/${space.id}/recipes/`));
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
});
