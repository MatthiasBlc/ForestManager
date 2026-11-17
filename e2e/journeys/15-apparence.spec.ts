// Parcours 15 : changer d'ambiance et de mode dans Profil > Apparence ; le
// choix s'applique tout de suite et persiste apres deconnexion et reconnexion.
import { expect, expectNoA11yViolations, loginAs, test } from "../support/test.ts";

test("parcours 15 : apparence persistante", async ({ page, scenario }) => {
  const { user: lea } = await scenario("user", { username: "lea" });
  await loginAs(page, lea);
  const html = page.locator("html");

  await page.goto("/");
  await page.getByRole("link", { name: "Profil de lea" }).click();
  await expect(page.getByRole("heading", { name: "lea" })).toBeVisible();
  await expectNoA11yViolations(page);
  await page.getByRole("navigation", { name: "Réglages du profil" }).getByText("Apparence").click();
  await expect(page.getByRole("heading", { name: "Apparence", level: 1 })).toBeVisible();
  await expectNoA11yViolations(page);

  // Chaque choix s'applique sans bouton "Enregistrer".
  await page.getByRole("radiogroup", { name: "Ambiance" }).getByText("Potager").click();
  await page
    .getByRole("group", { name: "Mode d'affichage" })
    .getByRole("button", { name: "Clair" })
    .click();
  await expect(html).toHaveAttribute("data-theme", "potager-light");
  await expectNoA11yViolations(page);
  await page
    .getByRole("group", { name: "Mode d'affichage" })
    .getByRole("button", { name: "Sombre" })
    .click();
  await page.getByRole("radiogroup", { name: "Densité" }).getByText("Compacte").click();
  await page
    .getByRole("radiogroup", { name: "Taille du texte" })
    .getByText("Grande")
    .first()
    .click();
  await expect(html).toHaveAttribute("data-theme", "potager-dark");
  await expect(html).toHaveAttribute("data-density", "compact");
  await expectNoA11yViolations(page);

  // Deconnexion : l'accueil public revient a l'ambiance par defaut.
  await page.getByRole("button", { name: "Retour" }).click();
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page.getByRole("link", { name: "Créer un compte" })).toBeVisible();
  await expect(html).not.toHaveAttribute("data-theme", /potager/);

  // Reconnexion par l'ecran : les choix reviennent avec le compte.
  await page.getByRole("link", { name: "Se connecter" }).click();
  await page.getByLabel("E-mail ou nom d'utilisateur").fill(lea.username);
  await page.getByLabel("Mot de passe").fill(lea.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("link", { name: "Profil de lea" })).toBeVisible();
  await expect(html).toHaveAttribute("data-theme", "potager-dark");
  await expect(html).toHaveAttribute("data-density", "compact");
  await page.goto("/profile/appearance");
  await expect(page.getByRole("radio", { name: /Potager/ })).toBeChecked();
  await expect(page.getByRole("radio", { name: "Grande", exact: true })).toBeChecked();
});
