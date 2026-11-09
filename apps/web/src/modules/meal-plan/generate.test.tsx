// Planning (C5.6) : F-GENERER (profil, periode, remplacer), rapport avec les
// cases vides expliquees [D113], "Garder ce planning" sans ecraser une case
// modifiee depuis [D110, D184] ; "Proposer un autre repas" depuis F-REPAS.
import type { GenerationPreview } from "@fm/shared";
import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../../app/App.tsx";
import { axeViolations } from "../../test/axe.ts";
import { buildMeal, buildProfile, mealPlanServer } from "../../test/meal-plan-server.ts";
import { renderWithProviders } from "../../test/render.tsx";

// Mardi 10 novembre 2026 : semaine du lundi 9 au dimanche 15.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 10, 10));
});

afterEach(() => {
  vi.useRealTimers();
});

const DAHL = "00000000-0000-4000-8000-0000000000c1";
const CURRY = "00000000-0000-4000-8000-0000000000c2";
const IDEA = "00000000-0000-4000-8000-0000000000c3";
const FISH = "00000000-0000-4000-8000-0000000000a2";

function previewFor(profileId: string, over: Partial<GenerationPreview> = {}): GenerationPreview {
  return {
    profile: { id: profileId, name: "Standard" },
    from: "2026-11-09",
    to: "2026-11-15",
    replace: false,
    proposals: [
      {
        date: "2026-11-10",
        mealTime: "DINNER",
        pick: { kind: "RECIPE", recipe: { id: DAHL, title: "Dahl de lentilles" } },
        reason: null,
        seenUpdatedAt: null,
      },
      {
        date: "2026-11-11",
        mealTime: "LUNCH",
        pick: { kind: "IDEA", idea: { id: IDEA, name: "Raclette" } },
        reason: null,
        seenUpdatedAt: "2026-11-05T10:00:00.000Z",
      },
      {
        date: "2026-11-13",
        mealTime: "DINNER",
        pick: null,
        reason: { code: "PIN", tag: { id: FISH, name: "Poisson" } },
        seenUpdatedAt: null,
      },
    ],
    skipped: { excluded: 1, locked: 2, kept: 0, skippedMeals: 0 },
    warnings: [
      {
        code: "MIN_NOT_MET",
        tag: { id: FISH, name: "Poisson" },
        required: 2,
        actual: 1,
        from: "2026-11-09",
        to: "2026-11-15",
      },
    ],
    ...over,
  };
}

describe("F-GENERER", () => {
  it("genere la semaine affichee avec le profil par defaut, puis garde le planning", async () => {
    const standard = buildProfile({ name: "Standard", isDefault: true });
    const summer = buildProfile({ name: "Été léger" });
    const s = mealPlanServer({ myRole: "MODERATOR", profiles: [standard, summer] });
    s.plan.preview = previewFor(standard.id);
    const { user, container } = renderWithProviders(<App />, {
      route: `/s/${s.space.id}/meal-plan`,
    });
    await user.click(await screen.findByRole("button", { name: "Générer" }));
    const sheet = await screen.findByRole("dialog", { name: "Générer le planning" });
    expect(await within(sheet).findByRole("radio", { name: /Standard/ })).toBeChecked();
    expect(within(sheet).getByText("Du lundi 9 au dimanche 15 novembre")).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
    await user.click(within(sheet).getByRole("button", { name: "Générer" }));

    await waitFor(() => {
      expect(s.plan.generations).toEqual([
        { profileId: standard.id, from: "2026-11-09", to: "2026-11-15", replace: false },
      ]);
    });
    const report = await screen.findByRole("dialog", { name: "Planning proposé" });
    expect(within(report).getByText("2 repas proposés sur 3")).toBeInTheDocument();
    expect(
      within(report).getByText("Laissés tels quels : 1 exclu, 2 verrouillés.")
    ).toBeInTheDocument();
    expect(within(report).getByText("Dahl de lentilles")).toBeInTheDocument();
    expect(within(report).getByText("Raclette")).toBeInTheDocument();
    expect(within(report).getByText("Mardi 10, soir")).toBeInTheDocument();
    expect(within(report).getByText("Vendredi 13, soir : laissé vide.")).toBeInTheDocument();
    expect(
      within(report).getByText("Aucune recette du tag « Poisson », épinglé sur ce repas.")
    ).toBeInTheDocument();
    expect(
      within(report).getByText("« Poisson » : 1 fois au lieu de 2 au moins, semaine du 9 novembre.")
    ).toBeInTheDocument();

    await user.click(within(report).getByRole("button", { name: "Garder ce planning" }));
    await waitFor(() => {
      expect(s.plan.applied).toEqual([
        {
          cells: [
            {
              date: "2026-11-10",
              mealTime: "DINNER",
              pick: { kind: "RECIPE", recipeId: DAHL },
              seenUpdatedAt: null,
            },
            {
              date: "2026-11-11",
              mealTime: "LUNCH",
              pick: { kind: "IDEA", ideaId: IDEA },
              seenUpdatedAt: "2026-11-05T10:00:00.000Z",
            },
          ],
        },
      ]);
    });
    expect(await screen.findByText("2 repas ajoutés au planning")).toBeInTheDocument();
  });

  it("autre profil, semaine suivante, remplacer les repas non verrouilles", async () => {
    const standard = buildProfile({ name: "Standard", isDefault: true });
    const summer = buildProfile({ name: "Été léger" });
    const s = mealPlanServer({ myRole: "OWNER", profiles: [standard, summer] });
    s.plan.preview = previewFor(summer.id);
    const { user } = renderWithProviders(<App />, { route: `/s/${s.space.id}/meal-plan` });
    await user.click(await screen.findByRole("button", { name: "Générer" }));
    const sheet = await screen.findByRole("dialog", { name: "Générer le planning" });
    await user.click(await within(sheet).findByRole("radio", { name: /Été léger/ }));
    await user.click(within(sheet).getByRole("button", { name: "La suivante" }));
    expect(within(sheet).getByText("Du lundi 16 au dimanche 22 novembre")).toBeInTheDocument();
    await user.click(within(sheet).getByRole("switch", { name: /Remplacer les repas/ }));
    await user.click(within(sheet).getByRole("button", { name: "Générer" }));
    await waitFor(() => {
      expect(s.plan.generations).toEqual([
        { profileId: summer.id, from: "2026-11-16", to: "2026-11-22", replace: true },
      ]);
    });
  });

  it("signale les repas modifies entre-temps, non remplaces", async () => {
    const standard = buildProfile({ name: "Standard", isDefault: true });
    const s = mealPlanServer({ myRole: "OWNER", profiles: [standard] });
    s.plan.preview = previewFor(standard.id);
    s.plan.applyConflicts = [{ date: "2026-11-11", mealTime: "LUNCH" }];
    const { user } = renderWithProviders(<App />, { route: `/s/${s.space.id}/meal-plan` });
    await user.click(await screen.findByRole("button", { name: "Générer" }));
    const sheet = await screen.findByRole("dialog", { name: "Générer le planning" });
    await within(sheet).findByRole("radio", { name: /Standard/ });
    await user.click(within(sheet).getByRole("button", { name: "Générer" }));
    const report = await screen.findByRole("dialog", { name: "Planning proposé" });
    await user.click(within(report).getByRole("button", { name: "Garder ce planning" }));
    expect(
      await screen.findByText(
        "1 repas ajouté. 1 repas modifié entre-temps par un membre n'a pas été remplacé."
      )
    ).toBeInTheDocument();
  });

  it("un membre ne genere pas", async () => {
    const s = mealPlanServer({ myRole: "MEMBER" });
    renderWithProviders(<App />, { route: `/s/${s.space.id}/meal-plan` });
    await screen.findByRole("heading", { name: "Mardi 10 novembre" });
    expect(screen.queryByRole("button", { name: "Générer" })).not.toBeInTheDocument();
  });
});

describe("proposer un autre repas", () => {
  const dahlMeal = buildMeal({
    date: "2026-11-10",
    mealTime: "DINNER",
    kind: "RECIPE",
    title: "Dahl de lentilles",
    recipe: { id: DAHL, imageUrl: null },
  });

  it("remplace le repas apres confirmation", async () => {
    const s = mealPlanServer({ myRole: "MEMBER", meals: [dahlMeal] });
    s.plan.suggestResult = {
      meal: { ...dahlMeal, title: "Curry", recipe: { id: CURRY, imageUrl: null } },
      reason: null,
    };
    const { user } = renderWithProviders(<App />, { route: `/s/${s.space.id}/meal-plan` });
    await user.click(await screen.findByRole("button", { name: /Dahl de lentilles/ }));
    const sheet = await screen.findByRole("dialog", { name: "Mardi 10, soir" });
    await user.click(within(sheet).getByRole("button", { name: "Proposer un autre repas" }));
    expect(s.plan.suggestions).toEqual([]);
    await user.click(within(sheet).getByRole("button", { name: "Remplacer" }));
    await waitFor(() => {
      expect(s.plan.suggestions).toEqual([{ date: "2026-11-10", mealTime: "DINNER" }]);
    });
    expect(await screen.findByText("Remplacé par « Curry »")).toBeInTheDocument();
  });

  it("rien a proposer : le repas reste et la raison s'affiche", async () => {
    const s = mealPlanServer({ myRole: "MEMBER", meals: [dahlMeal] });
    s.plan.suggestResult = { meal: null, reason: { code: "COOLDOWN", days: 3 } };
    const { user } = renderWithProviders(<App />, { route: `/s/${s.space.id}/meal-plan` });
    await user.click(await screen.findByRole("button", { name: /Dahl de lentilles/ }));
    const sheet = await screen.findByRole("dialog", { name: "Mardi 10, soir" });
    await user.click(within(sheet).getByRole("button", { name: "Proposer un autre repas" }));
    await user.click(within(sheet).getByRole("button", { name: "Remplacer" }));
    expect(
      await within(sheet).findByText(
        "Rien à proposer : toutes les recettes ont été prévues il y a moins de 3 jours."
      )
    ).toBeInTheDocument();
  });

  it("pas de proposition sur un repas verrouille", async () => {
    const s = mealPlanServer({ myRole: "MEMBER", meals: [{ ...dahlMeal, locked: true }] });
    const { user } = renderWithProviders(<App />, { route: `/s/${s.space.id}/meal-plan` });
    await user.click(await screen.findByRole("button", { name: /Dahl de lentilles/ }));
    const sheet = await screen.findByRole("dialog", { name: "Mardi 10, soir" });
    expect(
      within(sheet).queryByRole("button", { name: "Proposer un autre repas" })
    ).not.toBeInTheDocument();
  });
});
