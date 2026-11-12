import { describe, expect, it } from "vitest";

import { buildPersonalSpace, buildMe, buildSpaceDetail } from "../../test/fixtures.ts";
import { WEB_MODULES } from "../../modules/index.ts";
import { buildNavigation } from "./navigation.ts";

describe("buildNavigation", () => {
  it("espace perso (D95, D207) : Accueil, Mes recettes (onglet unique), puis Reglages dans Plus", () => {
    const space = buildPersonalSpace(buildMe());
    const nav = buildNavigation(space, WEB_MODULES);
    expect(nav.items.map((i) => i.id)).toEqual(["home", "recipes", "settings"]);
    expect(nav.tabs.map((i) => i.id)).toEqual(["home", "recipes"]);
    expect(nav.more.map((i) => i.id)).toEqual(["settings"]);
    const recipes = nav.items.find((i) => i.id === "recipes");
    expect(recipes?.label).toBe("Mes recettes");
    expect(recipes?.to).toBe(`/s/${space.id}/recipes`);
  });

  it("groupe : modules actifs dans l'ordre, puis Membres, Activite et Reglages ; modules sans code web ignores", () => {
    const space = buildSpaceDetail({
      modules: [
        { code: "inconnu", sortOrder: 0 },
        { code: "recipes", sortOrder: 1 },
      ],
    });
    const nav = buildNavigation(space, WEB_MODULES);
    expect(nav.items.map((i) => i.id)).toEqual(["recipes", "members", "activity", "settings"]);
    expect(nav.tabs.map((i) => i.id)).toEqual(["recipes"]);
    expect(nav.more.map((i) => i.id)).toEqual(["members", "activity", "settings"]);
  });

  it("au-dela de 4 modules, le reste passe dans Plus (D131)", () => {
    const fake = (code: string) => ({
      code,
      nav: () => [{ id: code, label: code, icon: "puzzle" as const, path: code }],
      Routes: WEB_MODULES[0]!.Routes,
    });
    const modules = ["m1", "m2", "m3", "m4", "m5"].map(fake);
    const space = buildSpaceDetail({
      modules: modules.map((m, i) => ({ code: m.code, sortOrder: i })),
    });
    const nav = buildNavigation(space, modules);
    expect(nav.tabs.map((i) => i.id)).toEqual(["m1", "m2", "m3", "m4"]);
    expect(nav.more.map((i) => i.id)).toEqual(["m5", "members", "activity", "settings"]);
  });
});
