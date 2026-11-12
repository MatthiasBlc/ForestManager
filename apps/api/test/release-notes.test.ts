// Notes de version calculees par la CI (C6.6) [D187] : sur un historique git de
// fixture (sortie brute de `git log`), sans depot git dans le conteneur de test.
import { describe, expect, it } from "vitest";

import { LOG_FORMAT, buildRelease, latestTag, parseLog } from "../src/scripts/release-notes.ts";

/** Sortie de `git log --format=LOG_FORMAT` : champs \x1f, commits \x1e. */
function log(...commits: (string | [string, string])[]): string {
  return commits
    .map((commit, i) => {
      const [subject, body] = Array.isArray(commit) ? commit : [commit, ""];
      return `${String(i).padStart(40, "0")}\x1f${subject}\x1f${body}\x1e\n`;
    })
    .join("");
}

const HISTORY = log(
  "docs: C6.5 fait, pause avant C6.6",
  "feat(web): messages des avis et de l'activite des modules (C6.5)",
  "feat(api): notifications et activite de Recettes et du Planning (C6.5)",
  "fix(web): erreur reseau sans perte de la recette en cache (C3.9, D169)",
  "fix: import par texte, ligne courte sans quantite lue comme ingredient",
  "perf(api): liste des recettes plus rapide",
  "test(api): matrice des permissions",
  "chore: dependances",
  "Merge branch 'Developement'"
);

describe("lecture de l'historique", () => {
  it("le format demande a git separe sujet et corps", () => {
    expect(LOG_FORMAT).toBe("%H%x1f%s%x1f%b%x1e");
    const commits = parseLog(log(["feat: A", "BREAKING CHANGE: tout change\n"], "fix: B"));
    expect(commits).toEqual([
      { subject: "feat: A", body: "BREAKING CHANGE: tout change" },
      { subject: "fix: B", body: "" },
    ]);
  });

  it("dernier tag semver, v1-final et les autres tags ignores", () => {
    expect(latestTag(["v1-final", "v2.0.0", "v2.10.0", "v2.9.3", "nightly"])).toBe("v2.10.0");
    expect(latestTag(["v1-final"])).toBeNull();
    expect(latestTag([])).toBeNull();
  });
});

describe("version et items", () => {
  it("aucun tag semver : 2.0.0 sans item, ecrite a la main par l'admin", () => {
    expect(buildRelease(null, parseLog(HISTORY))).toEqual({
      version: "2.0.0",
      content: { features: [], improvements: [], fixes: [] },
    });
  });

  it("mineure si feat, items classes, scopes et marqueurs retires, etapes regroupees", () => {
    expect(buildRelease("v2.3.1", parseLog(HISTORY))).toEqual({
      version: "2.4.0",
      content: {
        features: [
          {
            text: "Messages des avis et de l'activite des modules ; notifications et activite de Recettes et du Planning",
          },
        ],
        improvements: [{ text: "Liste des recettes plus rapide" }],
        fixes: [
          { text: "Erreur reseau sans perte de la recette en cache" },
          { text: "Import par texte, ligne courte sans quantite lue comme ingredient" },
        ],
      },
    });
  });

  it("corrective sans feat, majeure si ! ou BREAKING CHANGE", () => {
    expect(buildRelease("v2.3.1", parseLog(log("fix: a", "docs: b"))).version).toBe("2.3.2");
    expect(buildRelease("v2.3.1", parseLog(log("feat(api)!: a", "fix: b"))).version).toBe("3.0.0");
    expect(
      buildRelease("v2.3.1", parseLog(log(["fix: a", "BREAKING CHANGE: sessions videes"]))).version
    ).toBe("3.0.0");
  });

  it("aucun commit depuis le tag : la meme version, sans item (rien a publier)", () => {
    expect(buildRelease("v2.3.1", [])).toEqual({
      version: "2.3.1",
      content: { features: [], improvements: [], fixes: [] },
    });
  });
});
