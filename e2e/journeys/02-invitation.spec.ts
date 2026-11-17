// Parcours 2 : creer un espace, inviter par lien, le second compte rejoint par
// le lien (deux contextes : Lea invite, Tom arrive sans session).
import { expect, expectNoA11yViolations, expectToast, loginAs, test } from "../support/test.ts";

test("parcours 2 : espace cree, invitation par lien, arrivee du second compte", async ({
  page,
  scenario,
  otherPage,
}) => {
  const { user: lea } = await scenario("user", { username: "lea" });
  const { user: tom } = await scenario("user", { username: "tom" });
  await loginAs(page, lea);

  // Lea cree l'espace depuis le selecteur d'espaces.
  await page.goto("/");
  await page.getByRole("button", { name: /changer d'espace/ }).click();
  await page.getByRole("dialog", { name: "Espaces" }).getByText("Créer ou rejoindre").click();
  const creation = page.getByRole("dialog", { name: "Créer un espace" });
  await creation.getByLabel("Nom de l'espace").fill("Famille");
  await expectNoA11yViolations(page);
  await creation.getByRole("button", { name: "Créer l'espace" }).click();
  await expectToast(page, "Espace créé");
  await expect(page.getByRole("button", { name: /^Famille/ })).toBeVisible();

  // Membres, puis un lien d'invitation.
  await page.getByRole("navigation", { name: "Navigation" }).getByText("Plus").click();
  await page.getByRole("dialog", { name: "Plus" }).getByRole("link", { name: "Membres" }).click();
  await expect(page.getByRole("heading", { name: "Membres de Famille" })).toBeVisible();
  await expect(page.getByRole("main").getByText("1 membre", { exact: true })).toBeVisible();
  await expectNoA11yViolations(page);
  await page.getByRole("button", { name: "Inviter" }).click();
  const invite = page.getByRole("dialog", { name: "Inviter dans Famille" });
  await expectNoA11yViolations(page);
  await invite.getByRole("button", { name: "Créer le lien" }).click();
  const link = await invite.getByLabel("Lien d'invitation").inputValue();
  expect(link).toMatch(/^http:\/\/localhost\/join\/[\w-]{22}$/);

  // Tom ouvre le lien sans session : apercu, connexion, retour sur l'invitation.
  const tomPage = await otherPage();
  await tomPage.goto(link);
  await expect(tomPage.getByRole("heading", { name: "Rejoindre Famille" })).toBeVisible();
  await expect(tomPage.getByText(/1 membre · lien valable/)).toBeVisible();
  await expectNoA11yViolations(tomPage);
  await tomPage.getByRole("link", { name: "Se connecter" }).click();
  await tomPage.getByLabel("E-mail ou nom d'utilisateur").fill(tom.username);
  await tomPage.getByLabel("Mot de passe").fill(tom.password);
  await tomPage.getByRole("button", { name: "Se connecter" }).click();
  await tomPage.getByRole("button", { name: "Rejoindre l'espace" }).click();
  await expectToast(tomPage, "Bienvenue dans Famille");
  await expect(tomPage).toHaveURL(/\/s\/[0-9a-f-]{36}\/recipes$/);

  // Tom voit les membres mais ne peut pas inviter.
  await tomPage.getByRole("navigation", { name: "Navigation" }).getByText("Plus").click();
  await tomPage
    .getByRole("dialog", { name: "Plus" })
    .getByRole("link", { name: "Membres" })
    .click();
  await expect(tomPage.getByRole("listitem", { name: "lea" })).toContainText("Propriétaire");
  await expect(tomPage.getByRole("listitem", { name: "tom" })).toContainText("Membre");
  await expect(tomPage.getByRole("button", { name: "Inviter" })).toHaveCount(0);
  await expectNoA11yViolations(tomPage);

  // Chez Lea : deux membres, le lien a servi une fois.
  await page.reload();
  await expect(page.getByRole("main").getByText("2 membres", { exact: true })).toBeVisible();
  await expect(page.getByRole("listitem", { name: "tom" })).toBeVisible();
  await page.getByRole("button", { name: "Inviter" }).click();
  await expect(invite.getByText(/1 utilisation sur 3/)).toBeVisible();
});
