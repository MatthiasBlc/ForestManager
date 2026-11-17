// Dates du calendrier [D180] : semaines selon le debut choisi, libelles francais.
import { describe, expect, it } from "vitest";

import {
  addDays,
  dayLabel,
  shortDay,
  todayIso,
  weekDays,
  weekLabel,
  weekStart,
  whenLabel,
} from "./dates.ts";

describe("semaines", () => {
  it("debut de semaine selon le reglage", () => {
    // 2026-11-10 est un mardi.
    expect(weekStart("2026-11-10", "MON")).toBe("2026-11-09");
    expect(weekStart("2026-11-10", "SUN")).toBe("2026-11-08");
    expect(weekStart("2026-11-10", "SAT")).toBe("2026-11-07");
    expect(weekStart("2026-11-09", "MON")).toBe("2026-11-09");
    expect(weekStart("2026-11-08", "MON")).toBe("2026-11-02");
  });

  it("sept jours a partir du debut, en traversant les mois", () => {
    expect(weekDays("2026-11-30")).toEqual([
      "2026-11-30",
      "2026-12-01",
      "2026-12-02",
      "2026-12-03",
      "2026-12-04",
      "2026-12-05",
      "2026-12-06",
    ]);
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30");
  });

  it("aujourd'hui en date locale", () => {
    expect(todayIso(new Date(2026, 10, 10, 23, 30))).toBe("2026-11-10");
  });
});

describe("libelles", () => {
  it("semaine dans un mois ou a cheval sur deux", () => {
    expect(weekLabel("2026-11-02")).toBe("Semaine du 2 au 8 novembre");
    expect(weekLabel("2026-11-30")).toBe("Semaine du 30 novembre au 6 décembre");
    expect(weekLabel("2026-12-28")).toBe("Semaine du 28 décembre 2026 au 3 janvier 2027");
  });

  it("jour, jour court et repas", () => {
    expect(dayLabel("2026-11-03")).toBe("Mardi 3 novembre");
    expect(shortDay("2026-11-03")).toEqual({ day: "MAR", num: "3" });
    expect(whenLabel("2026-11-03", "DINNER")).toBe("Mardi 3, soir");
  });
});
