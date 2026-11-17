// Parcours 8 (D) : l'OWNER demande l'acces au Planning, le super admin
// l'accorde, l'OWNER l'active, le module apparait dans la navigation.
import { loginAdmin } from "../support/admin.ts";
import { expect, expectNoA11yViolations, expectToast, loginAs, test } from "../support/test.ts";

test(
  "parcours 8 : demande du Planning, accord de l'admin, activation",
  { tag: "@desktop" },
  async ({ page, scenario, otherPage }) => {
    const { owner, space } = await scenario("group", { spaceName: "Famille", members: [] });
    const { admin } = await scenario("admin");
    await loginAs(page, owner);

    // L'OWNER demande le module depuis les reglages de l'espace.
    await page.goto(`/s/${space.id}/settings`);
    await page.getByRole("link", { name: /Modules de l'espace/ }).click();
    await expect(page.getByRole("heading", { name: "Modules de Famille" })).toBeVisible();
    const planning = page.getByRole("listitem", { name: "Planning des repas" });
    await expect(planning.getByText("Disponible")).toBeVisible();
    await expectNoA11yViolations(page);
    await planning.getByRole("button", { name: "Demander l'accès" }).click();
    const request = page.getByRole("dialog", { name: "Demander Planning des repas" });
    await request.getByLabel("Message (facultatif)").fill("Pour organiser les dîners.");
    await expectNoA11yViolations(page);
    await request.getByRole("button", { name: "Envoyer la demande" }).click();
    await expectToast(page, "Demande envoyée");
    await expect(planning.getByText("Demande envoyée")).toBeVisible();

    // Le super admin voit la demande et l'accorde.
    const adminPage = await otherPage();
    await loginAdmin(adminPage, admin);
    await adminPage.goto("/admin/requests");
    await expect(
      adminPage.getByRole("heading", { name: "Demandes d'accès aux modules" })
    ).toBeVisible();
    const card = adminPage.getByRole("article", { name: "Famille demande Planning des repas" });
    await expect(card.getByText("Pour organiser les dîners.")).toBeVisible();
    await expect(card.getByText(new RegExp(`Demandée par ${owner.username}`))).toBeVisible();
    await expectNoA11yViolations(adminPage);
    await card.getByRole("button", { name: "Accorder" }).click();
    await expect(
      adminPage.getByRole("heading", { name: "Aucune demande en attente" })
    ).toBeVisible();
    await expectNoA11yViolations(adminPage);

    // L'OWNER active le module : il entre dans la navigation de l'espace.
    await page.reload();
    await expect(planning.getByText("Accordé")).toBeVisible();
    const active = planning.getByRole("switch", { name: "Actif pour les membres" });
    await expect(active).not.toBeChecked();
    await expect(page.getByRole("link", { name: "Planning" })).toHaveCount(0);
    await active.click();
    await expect(active).toBeChecked();
    await page.getByRole("link", { name: "Planning" }).click();
    await expect(page).toHaveURL(new RegExp(`/s/${space.id}/meal-plan`));
    await expectNoA11yViolations(page);
  }
);
