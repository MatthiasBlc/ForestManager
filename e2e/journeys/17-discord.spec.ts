// Parcours 17 (D) : connexion avec Discord [D202, D210], contre le faux Discord
// de la stack (docker/fake-discord) : inscription confirmee, rappel de secours,
// reconnexion, puis liaison d'un compte classique depuis le profil.
import { expect, expectNoA11yViolations, expectToast, loginAs, test } from "../support/test.ts";

const FAKE_DISCORD = "http://fake-discord:4000";

interface DiscordProfile {
  id: string;
  username: string;
  email: string | null;
  verified: boolean;
  avatar: string | null;
}

/** Profil que le faux Discord donnera au prochain passage. */
async function nextDiscordProfile(profile: DiscordProfile): Promise<void> {
  const res = await fetch(`${FAKE_DISCORD}/__profile`, {
    method: "POST",
    body: JSON.stringify(profile),
  });
  expect(res.ok, "fake discord profile").toBe(true);
}

const LEA: DiscordProfile = {
  id: "800000000000000001",
  username: "lea.discord",
  email: "lea@discord.test",
  verified: true,
  avatar: null,
};

test(
  "parcours 17 : inscription par Discord, secours, reconnexion, liaison",
  { tag: "@desktop" },
  async ({ page, scenario }) => {
    // 1. Inscription : ecran de confirmation, nom propose, email verifie.
    await nextDiscordProfile(LEA);
    await page.goto("/login");
    await page.getByRole("link", { name: "Continuer avec Discord" }).click();
    await expect(page.getByRole("heading", { name: "Créer ton compte" })).toBeVisible();
    await expect(page.getByLabel("Nom d'utilisateur")).toHaveValue("lea_discord");
    await expect(page.getByLabel("Adresse e-mail")).toHaveValue("lea@discord.test");
    await expect(page.getByText("Vérifiée", { exact: true })).toBeVisible();
    await expectNoA11yViolations(page);
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await expect(page.getByRole("heading", { name: "Bienvenue, lea_discord" })).toBeVisible();

    // 2. Profil : mot de passe de secours recommande, Discord relie.
    await page.goto("/profile");
    await expect(page.getByText("Ajoute un mot de passe de secours")).toBeVisible();
    await expect(page.getByText("Relié à lea.discord")).toBeVisible();
    await expectNoA11yViolations(page);

    // 3. Reconnexion par Discord : pas de nouvel ecran d'inscription.
    await page.getByRole("button", { name: "Se déconnecter" }).click();
    await expect(page.getByRole("link", { name: "Se connecter" })).toBeVisible();
    await nextDiscordProfile(LEA);
    await page.goto("/login?next=%2Fprofile");
    await page.getByRole("link", { name: "Continuer avec Discord" }).click();
    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByRole("heading", { name: "lea_discord" })).toBeVisible();
    await page.getByRole("button", { name: "Se déconnecter" }).click();
    await expect(page.getByRole("link", { name: "Se connecter" })).toBeVisible();

    // 4. Compte classique : relier Discord depuis le profil, puis s'y connecter.
    const { user: sam } = await scenario("user", { username: "sam" });
    await loginAs(page, sam);
    await page.goto("/profile");
    const samDiscord = { ...LEA, id: "800000000000000002", username: "sam.discord" };
    await nextDiscordProfile(samDiscord);
    await page.getByRole("link", { name: "Relier" }).click();
    await expectToast(page, "Compte Discord relié");
    await expect(page.getByText("Relié à sam.discord")).toBeVisible();
    await expect(page.getByText("Ajoute un mot de passe de secours")).toHaveCount(0);
    await page.getByRole("button", { name: "Se déconnecter" }).click();
    await expect(page.getByRole("link", { name: "Se connecter" })).toBeVisible();
    await nextDiscordProfile(samDiscord);
    await page.goto("/login?next=%2Fprofile");
    await page.getByRole("link", { name: "Continuer avec Discord" }).click();
    await expect(page.getByRole("heading", { name: "sam" })).toBeVisible();
  }
);
