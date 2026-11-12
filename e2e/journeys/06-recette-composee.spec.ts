// Parcours 6 : recette composee. Lier une sauce, changer les portions, les
// quantites sont recalculees ; modifier la sauce, le plat suit (lien vivant).
import { createRecipe } from "../support/recipes.ts";
import { expect, expectNoA11yViolations, loginAs, test } from "../support/test.ts";

test("parcours 6 : sauce liee, portions recalculees, lien vivant", async ({ page, scenario }) => {
  const { user: lea } = await scenario("user", { username: "lea" });
  await loginAs(page, lea);
  const home = lea.personalSpaceId;
  // Les deux recettes rendent 4 portions.
  const sauce = await createRecipe(page, home, {
    title: "Sauce tomate",
    ingredients: [[800, "g", "Tomates"]],
    steps: ["Mijoter 20 minutes."],
  });
  const lasagnes = await createRecipe(page, home, {
    title: "Lasagnes",
    ingredients: [[250, "g", "Feuilles de lasagne"]],
    steps: ["Monter et cuire 40 minutes."],
  });
  const dishUrl = `/s/${home}/recipes/${lasagnes.id}`;

  // Lier la sauce au plat : la moitie de ce qu'elle rend.
  await page.goto(`${dishUrl}/edit`);
  await page.getByRole("button", { name: "Ajouter un bloc" }).click();
  const add = page.getByRole("dialog", { name: "Ajouter un bloc" });
  await expectNoA11yViolations(page);
  await add.getByRole("button", { name: /Lier une recette/ }).click();
  const link = page.getByRole("dialog", { name: "Lier une recette" });
  const found = link.getByRole("listbox", { name: "Recettes trouvées" });
  // La recette en cours ne peut pas se lier a elle-meme.
  await expect(found.getByRole("option", { name: /Lasagnes/ })).toBeDisabled();
  await found.getByRole("option", { name: /Sauce tomate/ }).click();
  await link.getByLabel("Quantité utilisée").fill("2");
  await expect(link.getByText("pers. sur 4")).toBeVisible();
  await expectNoA11yViolations(page);
  await link.getByRole("button", { name: "Lier Sauce tomate" }).click();
  await expect(page.getByRole("group", { name: "Recette liée : Sauce tomate" })).toBeVisible();
  await expectNoA11yViolations(page);
  await page.getByRole("button", { name: "Enregistrer la révision 2" }).click();

  // Le plat est compose : la sauce se deplie a l'echelle (2 portions sur 4).
  await expect(page).toHaveURL(new RegExp(`${dishUrl}$`));
  await expect(page.getByRole("article").getByText("Composée", { exact: true })).toBeVisible();
  const linked = page.getByRole("region", { name: "Sauce tomate" });
  await linked.getByRole("button", { name: "Déplier Sauce tomate" }).click();
  await expect(linked.getByRole("checkbox", { name: "400 g Tomates" })).toBeVisible();
  await expect(linked.getByText("Mijoter 20 minutes.")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "250 g Feuilles de lasagne" })).toBeVisible();
  await expectNoA11yViolations(page);

  // De 4 a 8 portions : tout double, la sauce liee comprise.
  const servings = page.getByRole("group", { name: "Portions" });
  for (let i = 0; i < 4; i += 1) await servings.getByRole("button", { name: "Plus" }).click();
  await expect(servings.getByRole("status")).toHaveText(/^8/);
  await expect(page.getByRole("checkbox", { name: "500 g Feuilles de lasagne" })).toBeVisible();
  await expect(linked.getByRole("checkbox", { name: "800 g Tomates" })).toBeVisible();

  // La sauce change : 600 g de tomates et une cuisson plus longue.
  await page.goto(`/s/${home}/recipes/${sauce.id}/edit`);
  await page
    .getByRole("group", { name: "Ingrédient 1" })
    .first()
    .getByLabel("Quantité")
    .fill("600");
  await page.getByRole("textbox", { name: "Étape 1" }).fill("Mijoter 30 minutes.");
  await page.getByRole("button", { name: "Enregistrer la révision 2" }).click();
  await expect(page.getByRole("checkbox", { name: "600 g Tomates" })).toBeVisible();

  // Le plat suit sans avoir ete touche : il reste a sa revision 2.
  await page.goto(dishUrl);
  await expect(page.getByText(/· révision 2$/)).toBeVisible();
  await linked.getByRole("button", { name: "Déplier Sauce tomate" }).click();
  await expect(linked.getByRole("checkbox", { name: "300 g Tomates" })).toBeVisible();
  await expect(linked.getByText("Mijoter 30 minutes.")).toBeVisible();
});
