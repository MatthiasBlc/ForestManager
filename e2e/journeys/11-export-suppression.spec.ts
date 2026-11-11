// Parcours 11 : exporter un espace (Markdown avec photos) avant de le
// supprimer, puis le restaurer dans le delai.
import { readFile } from "node:fs/promises";

import { createRecipe } from "../support/recipes.ts";
import { photoFile, zipEntries } from "../support/storage.ts";
import { expect, expectNoA11yViolations, expectToast, loginAs, test } from "../support/test.ts";

test("parcours 11 : export de l'espace, suppression, restauration", async ({
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
  const gratin = await createRecipe(page, space.id, { title: "Gratin dauphinois" });
  await createRecipe(page, space.id, { title: "Soupe de potiron" });

  // Une photo sur le gratin : envoyee au stockage par le navigateur, puis relue.
  await page.goto(`/s/${space.id}/recipes/${gratin.id}`);
  await page.getByRole("link", { name: "Modifier" }).click();
  await page.getByLabel("Ajouter la photo").setInputFiles(photoFile());
  const photo = page.getByRole("img", { name: "Photo de la recette" });
  await expect(photo).toBeVisible();
  await expect
    .poll(() => photo.evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBeGreaterThan(0);
  await expectNoA11yViolations(page);

  // Reglages : supprimer, mais exporter d'abord.
  await page.goto(`/s/${space.id}/settings`);
  await page.getByRole("button", { name: "Supprimer Famille" }).click();
  const removal = page.getByRole("dialog", { name: "Supprimer Famille" });
  await expect(removal.getByText("Famille disparaît pour ses 2 membres.")).toBeVisible();
  await expectNoA11yViolations(page);
  await removal.getByRole("button", { name: "Exporter d'abord" }).click();
  const exportSheet = page.getByRole("dialog", { name: "Exporter des recettes" });
  await expect(exportSheet.getByRole("radio", { name: /Tout l'espace Famille/ })).toBeChecked();
  await exportSheet.getByRole("radio", { name: /Markdown/ }).check();
  await exportSheet.getByRole("switch", { name: "Inclure les photos" }).click();
  await expectNoA11yViolations(page);
  await exportSheet.getByRole("button", { name: "Préparer l'export" }).click();
  const downloadLink = exportSheet.getByRole("link", { name: "Télécharger" });
  await expect(downloadLink).toBeVisible();
  await expectNoA11yViolations(page);
  const [download] = await Promise.all([page.waitForEvent("download"), downloadLink.click()]);
  expect(download.suggestedFilename()).toMatch(/\.zip$/);
  const files = zipEntries(await readFile(await download.path()));
  expect(files.filter((name) => name.endsWith(".md"))).toHaveLength(2);
  expect(files.some((name) => /\.(webp|jpe?g|png)$/.test(name))).toBe(true);

  // Un seul export d'espace par jour.
  await exportSheet.getByRole("button", { name: "Fermer" }).click();
  await page.getByRole("button", { name: "Supprimer Famille" }).click();
  await removal.getByRole("button", { name: "Exporter d'abord" }).click();
  await exportSheet.getByRole("radio", { name: /Markdown/ }).check();
  await exportSheet.getByRole("button", { name: "Préparer l'export" }).click();
  await expect(
    exportSheet.getByText(/Prochain export de l'espace possible demain à/)
  ).toBeVisible();
  await exportSheet.getByRole("button", { name: "Fermer" }).click();

  // L'activite de l'espace le dit aux membres.
  await page.goto(`/s/${space.id}/activity`);
  await expect(
    page
      .getByRole("main")
      .getByText(/a exporté l'espace/)
      .first()
  ).toBeVisible();
  await expectNoA11yViolations(page);

  // Suppression : confirmee par le nom de l'espace.
  await page.goto(`/s/${space.id}/settings`);
  await page.getByRole("button", { name: "Supprimer Famille" }).click();
  const confirm = removal.getByRole("button", { name: "Supprimer Famille" });
  await expect(confirm).toBeDisabled();
  await removal.getByLabel("Pour confirmer, tape Famille").fill("Famille");
  await confirm.click();
  await expectToast(page, "Famille supprimé, restaurable 30 jours");
  await expect(page).toHaveURL(new RegExp(`/s/${lea.personalSpaceId}/`));

  // Tom, membre, ne voit plus l'espace.
  const tomPage = await otherPage();
  await loginAs(tomPage, tom);
  await tomPage.goto(`/s/${space.id}/recipes`);
  await expect(tomPage.getByRole("heading", { name: "Espace introuvable" })).toBeVisible();

  // Lea le retrouve dans ses espaces, en cours de suppression, et le restaure.
  await page.getByRole("button", { name: /changer d'espace/ }).click();
  const spaces = page.getByRole("dialog", { name: "Espaces" });
  await expect(spaces.getByText(/Suppression dans \d+ j/)).toBeVisible();
  await spaces.getByRole("button", { name: /^Famille/ }).click();
  await expect(
    page.getByRole("heading", { name: "Famille est en cours de suppression" })
  ).toBeVisible();
  await expectNoA11yViolations(page);
  await page.getByRole("button", { name: "Restaurer Famille" }).click();
  await expectToast(page, "Famille restauré");

  // Tout est revenu, pour elle comme pour Tom.
  await page.goto(`/s/${space.id}/recipes`);
  await expect(page.getByRole("article", { name: "Gratin dauphinois" })).toBeVisible();
  await expect(page.getByRole("article", { name: "Soupe de potiron" })).toBeVisible();
  await tomPage.reload();
  await expect(tomPage.getByRole("article", { name: "Gratin dauphinois" })).toBeVisible();
});
