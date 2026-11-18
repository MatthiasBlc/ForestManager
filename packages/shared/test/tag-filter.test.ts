// Filtre par tags [D216] : OU dans une famille, ET entre familles ; un tag sans
// famille compte comme sa propre famille.
import { describe, expect, it } from "vitest";

import { matchesTagFilter, tagFilterGroups } from "../src/index.ts";

const families = new Map<string, string | null>([
  ["hiver", "saison"],
  ["automne", "saison"],
  ["plat", "type"],
  ["dessert", "type"],
  ["rapide", null],
  ["congelable", null],
]);
const familyOf = (id: string) => families.get(id) ?? null;

describe("tagFilterGroups", () => {
  it("groupe par famille, un groupe par tag sans famille, dans l'ordre de selection", () => {
    expect(tagFilterGroups(["hiver", "rapide", "automne", "plat", "congelable"], familyOf)).toEqual(
      [["hiver", "automne"], ["rapide"], ["plat"], ["congelable"]]
    );
    expect(tagFilterGroups([], familyOf)).toEqual([]);
  });
});

describe("matchesTagFilter", () => {
  it("OU dans une famille", () => {
    expect(matchesTagFilter(["automne"], ["hiver", "automne"], familyOf)).toBe(true);
    expect(matchesTagFilter(["plat"], ["hiver", "automne"], familyOf)).toBe(false);
  });

  it("ET entre familles, et entre tags sans famille", () => {
    expect(matchesTagFilter(["hiver", "plat"], ["hiver", "automne", "plat"], familyOf)).toBe(true);
    expect(matchesTagFilter(["hiver"], ["hiver", "plat"], familyOf)).toBe(false);
    expect(matchesTagFilter(["rapide"], ["rapide", "congelable"], familyOf)).toBe(false);
    expect(matchesTagFilter(["rapide", "congelable"], ["rapide", "congelable"], familyOf)).toBe(
      true
    );
  });

  it("sans tag choisi, tout passe", () => {
    expect(matchesTagFilter([], [], familyOf)).toBe(true);
  });
});
