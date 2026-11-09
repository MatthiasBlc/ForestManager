// Planning (C5.4) : E-PROFILS-GENERATION. Profils (par defaut, nouveau, dupliquer,
// supprimer en designant le remplacant) [D183], regles avec paliers de poids et
// mode avance [D184], grille jours x repas des exclusions et epinglages [D114].
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../../app/App.tsx";
import { axeViolations } from "../../test/axe.ts";
import { buildProfile, FISH, mealPlanServer, VEGETARIAN } from "../../test/meal-plan-server.ts";
import { renderWithProviders } from "../../test/render.tsx";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 10, 10));
});

afterEach(() => {
  vi.useRealTimers();
});

function openProfiles(s: ReturnType<typeof mealPlanServer>) {
  return renderWithProviders(<App />, { route: `/s/${s.space.id}/meal-plan/profiles` });
}

describe("acces", () => {
  it("un moderateur ouvre les profils depuis le planning", async () => {
    const s = mealPlanServer({ myRole: "MODERATOR" });
    const { user, container } = renderWithProviders(<App />, {
      route: `/s/${s.space.id}/meal-plan`,
    });
    await user.click(await screen.findByRole("link", { name: "Profils de génération" }));
    expect(await screen.findByRole("heading", { name: "Standard" })).toBeInTheDocument();
    expect(screen.getByText("Par défaut")).toBeInTheDocument();
    expect(
      screen.getByText("Aucune règle : toutes les recettes ont la même chance.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Jeudi midi : généré" })).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
  });

  it("un membre n'y a pas acces", async () => {
    const s = mealPlanServer({ myRole: "MEMBER" });
    renderWithProviders(<App />, { route: `/s/${s.space.id}/meal-plan` });
    await screen.findByRole("heading", { name: "Mardi 10 novembre" });
    expect(screen.queryByRole("link", { name: "Profils de génération" })).not.toBeInTheDocument();
  });
});

describe("reglages du profil", () => {
  it("delai avant de reproposer une recette et idees", async () => {
    const s = mealPlanServer({ myRole: "OWNER" });
    const { user } = openProfiles(s);
    const stepper = await screen.findByRole("group", {
      name: "Délai avant de reproposer une recette",
    });
    await user.click(within(stepper).getByRole("button", { name: "Plus" }));
    await waitFor(() => {
      expect(s.plan.profilePatches).toContainEqual(expect.objectContaining({ cooldownDays: 4 }));
    });
    await user.click(screen.getByRole("switch", { name: "Proposer aussi les idées de repas" }));
    await waitFor(() => {
      expect(s.plan.profilePatches).toContainEqual(expect.objectContaining({ useIdeas: false }));
    });
  });
});

describe("regles (D184)", () => {
  it("ajoute une regle de tag : repas, palier de poids, frequence", async () => {
    const s = mealPlanServer({ myRole: "OWNER" });
    const { user } = openProfiles(s);
    await user.click(await screen.findByRole("button", { name: "Ajouter une règle" }));
    const sheet = await screen.findByRole("dialog", { name: "Nouvelle règle" });
    // Tags en pastilles : la feuille reste courte meme avec beaucoup de tags.
    const tags = within(sheet).getByRole("group", { name: "Tag" });
    await user.click(within(tags).getByRole("button", { name: "Végétarien" }));
    expect(within(tags).getByRole("button", { name: "Végétarien" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await user.click(within(sheet).getByRole("button", { name: "Soir" }));
    await user.click(within(sheet).getByRole("button", { name: "Plus souvent" }));
    const min = within(sheet).getByRole("group", { name: "Au moins" });
    await user.click(within(min).getByRole("button", { name: "Plus" }));
    await user.click(within(min).getByRole("button", { name: "Plus" }));
    await user.click(within(sheet).getByRole("button", { name: "Ajouter la règle" }));

    await waitFor(() => {
      expect(s.plan.ruleBodies).toEqual([
        {
          target: { kind: "TAG", tagId: VEGETARIAN.id },
          weight: 1.5,
          mealTime: "DINNER",
          frequencyMin: 2,
          frequencyMax: null,
          frequencyPer: "PER_WEEK",
          tagCooldownDays: null,
        },
      ]);
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Nouvelle règle" })).not.toBeInTheDocument();
    });
    const rule = screen.getByRole("button", { name: /Végétarien/ });
    expect(rule).toHaveTextContent("Le soir · au moins 2 fois par semaine · poids ×1,5");
  });

  it("mode avance : jauge de 0 a 200 % par pas de 5 %", async () => {
    const s = mealPlanServer({ myRole: "OWNER" });
    const { user } = openProfiles(s);
    await user.click(await screen.findByRole("button", { name: "Ajouter une règle" }));
    const sheet = await screen.findByRole("dialog", { name: "Nouvelle règle" });
    await user.click(
      within(within(sheet).getByRole("group", { name: "Tag" })).getByRole("button", {
        name: "Poisson",
      })
    );
    await user.click(within(sheet).getByRole("switch", { name: "Réglage fin" }));
    const gauge = within(sheet).getByRole("slider", { name: "Poids" });
    fireEvent.change(gauge, { target: { value: "135" } });
    expect(within(sheet).getByText("135 %")).toBeInTheDocument();
    await user.click(within(sheet).getByRole("button", { name: "Ajouter la règle" }));
    await waitFor(() => {
      expect(s.plan.ruleBodies[0]).toMatchObject({
        target: { tagId: FISH.id },
        weight: 1.35,
      });
    });
  });

  it("une regle au poids hors palier s'ouvre en mode avance", async () => {
    const s = mealPlanServer({
      myRole: "OWNER",
      profiles: [
        buildProfile({
          name: "Standard",
          isDefault: true,
          rules: [
            {
              id: "00000000-0000-4000-8000-0000000000b1",
              target: { kind: "TAG", tag: { id: FISH.id, name: "Poisson", status: "ACTIVE" } },
              weight: 1.2,
              mealTime: "LUNCH",
              frequencyMin: null,
              frequencyMax: null,
              frequencyPer: null,
              tagCooldownDays: null,
            },
          ],
        }),
      ],
    });
    const { user } = openProfiles(s);
    const rule = await screen.findByRole("button", { name: /Poisson/ });
    expect(rule).toHaveTextContent("Le midi · poids ×1,2");
    await user.click(rule);
    const sheet = await screen.findByRole("dialog", { name: "Modifier la règle" });
    expect(within(sheet).getByRole("switch", { name: "Réglage fin" })).toBeChecked();
    expect(within(sheet).getByRole("slider", { name: "Poids" })).toHaveValue("120");
    await user.click(within(sheet).getByRole("button", { name: "Supprimer la règle" }));
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /Poisson/ })).not.toBeInTheDocument();
    });
  });

  it("signale une regle dont le tag a ete supprime", async () => {
    const s = mealPlanServer({
      myRole: "OWNER",
      profiles: [
        buildProfile({
          name: "Standard",
          isDefault: true,
          rules: [
            {
              id: "00000000-0000-4000-8000-0000000000b2",
              target: { kind: "TAG", tag: { id: FISH.id, name: "Ancien", status: "DELETED" } },
              weight: 1,
              mealTime: null,
              frequencyMin: null,
              frequencyMax: null,
              frequencyPer: null,
              tagCooldownDays: null,
            },
          ],
        }),
      ],
    });
    openProfiles(s);
    const rule = await screen.findByRole("button", { name: /Ancien/ });
    expect(rule).toHaveTextContent("Tag supprimé : règle ignorée");
  });
});

describe("grille jours x repas (D114)", () => {
  it("exclut un repas puis y epingle un tag", async () => {
    const s = mealPlanServer({ myRole: "OWNER" });
    const { user } = openProfiles(s);
    await user.click(await screen.findByRole("button", { name: "Jeudi midi : généré" }));
    let sheet = await screen.findByRole("dialog", { name: "Jeudi midi" });
    await user.click(within(sheet).getByRole("radio", { name: /Exclu/ }));
    await user.click(within(sheet).getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByRole("button", { name: "Jeudi midi : exclu" })).toBeInTheDocument();
    expect(s.plan.grids.at(-1)).toEqual({
      cells: [{ weekday: "THU", mealTime: "LUNCH", state: "EXCLUDED" }],
    });

    await user.click(screen.getByRole("button", { name: "Vendredi soir : généré" }));
    sheet = await screen.findByRole("dialog", { name: "Vendredi soir" });
    await user.click(within(sheet).getByRole("radio", { name: /Épingler un tag/ }));
    await user.click(
      within(within(sheet).getByRole("group", { name: "Tag épinglé" })).getByRole("button", {
        name: "Poisson",
      })
    );
    await user.click(within(sheet).getByRole("button", { name: "Enregistrer" }));
    expect(
      await screen.findByRole("button", { name: "Vendredi soir : tag Poisson épinglé" })
    ).toBeInTheDocument();
    expect(s.plan.grids.at(-1)).toEqual({
      cells: [
        { weekday: "THU", mealTime: "LUNCH", state: "EXCLUDED" },
        { weekday: "FRI", mealTime: "DINNER", state: "PINNED", tagId: FISH.id },
      ],
    });
  });

  it("ne montre que les repas planifies par l'espace", async () => {
    const s = mealPlanServer({ myRole: "OWNER", settings: { mealTimes: ["DINNER"] } });
    openProfiles(s);
    expect(await screen.findByRole("button", { name: "Lundi soir : généré" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lundi midi : généré" })).not.toBeInTheDocument();
  });
});

describe("profils (D183)", () => {
  it("cree un profil, le choisit par defaut", async () => {
    const s = mealPlanServer({ myRole: "OWNER" });
    const { user } = openProfiles(s);
    await user.click(await screen.findByRole("button", { name: "Nouveau profil" }));
    const sheet = await screen.findByRole("dialog", { name: "Nouveau profil" });
    await user.type(within(sheet).getByLabelText("Nom"), "Été léger");
    await user.click(within(sheet).getByRole("button", { name: "Créer" }));
    expect(await screen.findByRole("heading", { name: "Été léger" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Actions du profil" }));
    await user.click(await screen.findByRole("menuitem", { name: "Utiliser par défaut" }));
    await waitFor(() => {
      expect(s.plan.profilePatches).toContainEqual(expect.objectContaining({ isDefault: true }));
    });
  });

  it("supprimer le profil par defaut demande son remplacant", async () => {
    const summer = buildProfile({ name: "Été léger" });
    const standard = buildProfile({ name: "Standard", isDefault: true });
    const s = mealPlanServer({ myRole: "OWNER", profiles: [standard, summer] });
    const { user } = openProfiles(s);
    await screen.findByRole("heading", { name: "Standard" });
    await user.click(screen.getByRole("button", { name: "Actions du profil" }));
    await user.click(await screen.findByRole("menuitem", { name: "Supprimer" }));
    const sheet = await screen.findByRole("dialog", { name: "Supprimer « Standard » ?" });
    await user.click(within(sheet).getByRole("radio", { name: "Été léger" }));
    await user.click(within(sheet).getByRole("button", { name: "Supprimer le profil" }));
    await waitFor(() => {
      expect(s.plan.deletedProfiles).toEqual([{ id: standard.id, defaultId: summer.id }]);
    });
    expect(await screen.findByRole("heading", { name: "Été léger" })).toBeInTheDocument();
  });

  it("le dernier profil ne propose pas la suppression", async () => {
    const s = mealPlanServer({ myRole: "OWNER" });
    const { user } = openProfiles(s);
    await screen.findByRole("heading", { name: "Standard" });
    await user.click(screen.getByRole("button", { name: "Actions du profil" }));
    expect(await screen.findByRole("menuitem", { name: "Dupliquer" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Supprimer" })).not.toBeInTheDocument();
  });
});
