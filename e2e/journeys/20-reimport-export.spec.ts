// Parcours 20 : exporter un espace (JSON avec photos), puis reimporter
// l'archive dans un autre espace [D225] : apercu a cocher, import, photo
// reprise, et doublons decoches a un second passage.
import { createRecipe } from "../support/recipes.ts";
import { photoFile } from "../support/storage.ts";
import { expect, expectNoA11yViolations, expectToast, loginAs, test } from "../support/test.ts";

test("parcours 20 : export d'un espace, reimport dans un autre", async ({
  page,
  scenario,
  otherPage,
}) => {
  const { owner: lea, space: famille } = await scenario("group", {
    spaceName: "Famille",
    ownerName: "lea",
  });
  const { owner: tom, space: colocs } = await scenario("group", {
    spaceName: "Colocs",
    ownerName: "tom",
  });
  await loginAs(page, lea);
  const gratin = await createRecipe(page, famille.id, { title: "Gratin dauphinois" });
  await createRecipe(page, famille.id, { title: "Soupe de potiron" });

  // Une photo sur le gratin, pour la retrouver apres le reimport.
  await page.goto(`/s/${famille.id}/recipes/${gratin.id}`);
  await page.getByRole("link", { name: "Modifier" }).click();
  await page.getByLabel("Ajouter la photo").setInputFiles(photoFile());
  await expect(page.getByRole("img", { name: "Photo de la recette" })).toBeVisible();

  // Lea exporte Famille au format JSON, photos comprises.
  await page.goto(`/s/${famille.id}/settings`);
  await page.getByRole("button", { name: "Exporter l'espace" }).click();
  const exportSheet = page.getByRole("dialog", { name: "Exporter des recettes" });
  await expect(exportSheet.getByRole("radio", { name: /JSON/ })).toBeChecked();
  await exportSheet.getByRole("switch", { name: "Inclure les photos" }).click();
  await exportSheet.getByRole("button", { name: "Préparer l'export" }).click();
  const downloadLink = exportSheet.getByRole("link", { name: "Télécharger" });
  await expect(downloadLink).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent("download"), downloadLink.click()]);
  const archive = await download.path();

  // Tom reimporte l'archive dans Colocs : Creer > Importer un export.
  const tomPage = await otherPage();
  await loginAs(tomPage, tom);
  await tomPage.goto(`/s/${colocs.id}/recipes`);
  const openImport = async () => {
    await tomPage.getByRole("button", { name: "Ajouter une recette" }).first().click();
    await tomPage
      .getByRole("dialog", { name: "Ajouter une recette dans Colocs" })
      .getByRole("button", { name: /Créer/ })
      .click();
    await tomPage
      .getByRole("dialog", { name: "Créer une recette" })
      .getByRole("button", { name: /Importer un export/ })
      .click();
    const sheet = tomPage.getByRole("dialog", { name: "Importer un export" });
    await expect(sheet).toBeVisible();
    await sheet.getByLabel("Fichier d'export").setInputFiles(archive);
    return tomPage.getByRole("dialog", { name: "Recettes à importer" });
  };

  const picker = await openImport();
  await expect(picker.getByRole("checkbox", { name: /Gratin dauphinois/ })).toBeChecked();
  await expect(picker.getByRole("checkbox", { name: /Soupe de potiron/ })).toBeChecked();
  await expectNoA11yViolations(tomPage);
  await picker.getByRole("button", { name: "Importer 2 recettes" }).click();
  await expectToast(tomPage, "2 recettes importées dans Colocs");
  await expect(picker).toBeHidden();

  // Les recettes sont dans Colocs, au nom de Tom, la photo du gratin reprise.
  await tomPage.getByRole("article", { name: "Gratin dauphinois" }).click();
  await expect(tomPage.getByRole("heading", { name: "Gratin dauphinois" })).toBeVisible();
  const photo = tomPage.getByRole("img", { name: "Photo de la recette" });
  await expect(photo).toBeVisible();
  await expect
    .poll(() => photo.evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBeGreaterThan(0);

  // Second passage : tout est deja la, rien n'est coche.
  await tomPage.goto(`/s/${colocs.id}/recipes`);
  const again = await openImport();
  await expect(again.getByText("Déjà dans l'espace")).toHaveCount(2);
  await expect(again.getByRole("checkbox", { name: /Gratin dauphinois/ })).not.toBeChecked();
  await expect(again.getByRole("button", { name: "Choisis au moins une recette" })).toBeDisabled();
});
