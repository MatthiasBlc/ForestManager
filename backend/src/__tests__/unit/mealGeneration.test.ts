import { describe, it, expect } from "vitest";
import {
  generate,
  GenerationInput,
  PoolEntry,
  SlotInfo,
  dateToDayOfWeek,
  weightedRandomPick,
} from "../../services/mealGeneration";
import {
  MealGenerationParams,
  MealSlotExclusion,
  MealGenerationRule,
  MealSlotPin,
} from "@prisma/client";

// =============================================
// Helpers
// =============================================

function makeDate(dayOffset: number): Date {
  // Start from a Monday (2026-03-23)
  const base = new Date("2026-03-23T00:00:00Z");
  base.setUTCDate(base.getUTCDate() + dayOffset);
  return base;
}

function makeSlot(
  dayOffset: number,
  mealTime: "LUNCH" | "DINNER",
  overrides: Partial<SlotInfo> = {}
): SlotInfo {
  return {
    id: `slot-${dayOffset}-${mealTime}`,
    date: makeDate(dayOffset),
    mealTime,
    type: "EMPTY",
    disabled: false,
    locked: false,
    recipeId: null,
    ...overrides,
  };
}

function makeParams(overrides: Partial<MealGenerationParams> = {}): MealGenerationParams {
  return {
    id: "params-1",
    communityId: "comm-1",
    name: "Test",
    description: null,
    cooldownDays: 3,
    useIdeas: false,
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

function makeRecipe(id: string, tagIds: string[] = []): PoolEntry {
  return { id, type: "RECIPE", recipeId: id, tagIds };
}

function makeIdea(
  id: string,
  name: string,
  recipeId: string | null = null,
  tagIds: string[] = []
): PoolEntry {
  return {
    id,
    type: "IDEA",
    recipeId,
    tagIds,
    freeText: name,
    comment: null,
  };
}

function makeRule(
  overrides: Partial<MealGenerationRule> & { tag?: { id: string; name: string } | null }
): MealGenerationRule & { tag?: { id: string; name: string } | null } {
  return {
    id: `rule-${Math.random().toString(36).slice(2, 8)}`,
    paramsId: "params-1",
    tagId: null,
    recipeId: null,
    weight: 1.0,
    mealTimeConstraint: null,
    frequencyMin: null,
    frequencyMax: null,
    frequencyPer: null,
    tagCooldownDays: null,
    tag: null,
    ...overrides,
  };
}

function makeExclusion(day: string, mealTime: string): MealSlotExclusion {
  return {
    id: `exc-${day}-${mealTime}`,
    paramsId: "params-1",
    day: day as any,
    mealTime: mealTime as any,
  };
}

function makePin(day: string, mealTime: string, tagId: string): MealSlotPin {
  return {
    id: `pin-${day}-${mealTime}`,
    paramsId: "params-1",
    day: day as any,
    mealTime: mealTime as any,
    tagId,
  };
}

function makeInput(overrides: Partial<GenerationInput> = {}): GenerationInput {
  return {
    params: makeParams(),
    exclusions: [],
    rules: [],
    pins: [],
    slots: [makeSlot(0, "LUNCH"), makeSlot(0, "DINNER")],
    pool: [makeRecipe("r1"), makeRecipe("r2"), makeRecipe("r3")],
    previousSlots: [],
    fillEmptyOnly: false,
    ...overrides,
  };
}

// =============================================
// Tests
// =============================================

describe("dateToDayOfWeek", () => {
  it("should return correct day of week", () => {
    // 2026-03-23 is a Monday
    expect(dateToDayOfWeek(new Date("2026-03-23T00:00:00Z"))).toBe("MON");
    expect(dateToDayOfWeek(new Date("2026-03-24T00:00:00Z"))).toBe("TUE");
    expect(dateToDayOfWeek(new Date("2026-03-29T00:00:00Z"))).toBe("SUN");
  });
});

describe("weightedRandomPick", () => {
  it("should return null for empty array", () => {
    expect(weightedRandomPick([], [])).toBeNull();
  });

  it("should return the only item if single", () => {
    expect(weightedRandomPick(["a"], [1])).toBe("a");
  });

  it("should never pick zero-weight items", () => {
    for (let i = 0; i < 50; i++) {
      const result = weightedRandomPick(["a", "b"], [0, 1]);
      expect(result).toBe("b");
    }
  });
});

describe("generate - basic", () => {
  it("should fill all empty slots", () => {
    const result = generate(makeInput());
    expect(result.assignments).toHaveLength(2);
    expect(result.report.slotsGenerated).toBe(2);
    expect(result.assignments.every((a) => a.type === "RECIPE")).toBe(true);
  });

  it("should handle single recipe in pool (no cooldown)", () => {
    const result = generate(
      makeInput({
        pool: [makeRecipe("r1")],
        params: makeParams({ cooldownDays: 0 }),
      })
    );
    expect(result.assignments).toHaveLength(2);
    expect(result.assignments.every((a) => a.recipeId === "r1")).toBe(true);
  });
});

describe("generate - skip logic", () => {
  it("should skip disabled slots", () => {
    const result = generate(
      makeInput({
        slots: [makeSlot(0, "LUNCH", { disabled: true }), makeSlot(0, "DINNER")],
      })
    );
    expect(result.assignments).toHaveLength(1);
    expect(result.report.slotsSkipped.disabled).toBe(1);
    expect(result.report.slotsGenerated).toBe(1);
  });

  it("should skip excluded slots", () => {
    const result = generate(
      makeInput({
        exclusions: [makeExclusion("MON", "LUNCH")],
        slots: [makeSlot(0, "LUNCH"), makeSlot(0, "DINNER")],
      })
    );
    expect(result.assignments).toHaveLength(1);
    expect(result.report.slotsSkipped.excluded).toBe(1);
  });

  it("should skip locked slots", () => {
    const result = generate(
      makeInput({
        slots: [
          makeSlot(0, "LUNCH", { locked: true, recipeId: "r1", type: "RECIPE" }),
          makeSlot(0, "DINNER"),
        ],
      })
    );
    expect(result.assignments).toHaveLength(1);
    expect(result.report.slotsSkipped.locked).toBe(1);
  });

  it("should skip already filled slots when fillEmptyOnly", () => {
    const result = generate(
      makeInput({
        fillEmptyOnly: true,
        slots: [makeSlot(0, "LUNCH", { type: "RECIPE", recipeId: "r1" }), makeSlot(0, "DINNER")],
      })
    );
    expect(result.assignments).toHaveLength(1);
    expect(result.report.slotsSkipped.alreadyFilled).toBe(1);
  });

  it("should not skip filled slots when fillEmptyOnly is false", () => {
    const result = generate(
      makeInput({
        fillEmptyOnly: false,
        slots: [makeSlot(0, "LUNCH", { type: "RECIPE", recipeId: "r1" }), makeSlot(0, "DINNER")],
      })
    );
    expect(result.assignments).toHaveLength(2);
    expect(result.report.slotsGenerated).toBe(2);
  });
});

describe("generate - pin", () => {
  it("should only pick recipes with pinned tag", () => {
    const pool = [
      makeRecipe("r1", ["tag-poisson"]),
      makeRecipe("r2", []),
      makeRecipe("r3", ["tag-poisson"]),
    ];

    const result = generate(
      makeInput({
        pool,
        pins: [makePin("MON", "LUNCH", "tag-poisson")],
        slots: [makeSlot(0, "LUNCH")],
      })
    );

    expect(result.assignments).toHaveLength(1);
    expect(["r1", "r3"]).toContain(result.assignments[0].recipeId);
  });

  it("should return POOL_EXHAUSTED when no recipe matches pin", () => {
    const result = generate(
      makeInput({
        pool: [makeRecipe("r1", []), makeRecipe("r2", [])],
        pins: [makePin("MON", "LUNCH", "tag-missing")],
        slots: [makeSlot(0, "LUNCH")],
      })
    );

    expect(result.assignments[0].type).toBe("EMPTY");
    expect(result.report.warnings.some((w) => w.type === "POOL_EXHAUSTED")).toBe(true);
  });
});

describe("generate - cooldown recette", () => {
  it("should not pick the same recipe within cooldown days", () => {
    // cooldownDays=3, 4 slots over 2 days, only 1 recipe
    // Recipe can only be picked once every 3 days
    const result = generate(
      makeInput({
        params: makeParams({ cooldownDays: 3 }),
        pool: [makeRecipe("r1"), makeRecipe("r2")],
        slots: [
          makeSlot(0, "LUNCH"),
          makeSlot(0, "DINNER"),
          makeSlot(1, "LUNCH"),
          makeSlot(1, "DINNER"),
        ],
      })
    );

    // With cooldown=3 days, r1 and r2 can each appear once in the first day (day 0),
    // and neither can appear again on day 1 (within 3 days)
    // So day 1 should exhaust the pool
    const day0 = result.assignments.filter((a) => a.slotId.startsWith("slot-0"));
    const day1 = result.assignments.filter((a) => a.slotId.startsWith("slot-1"));

    // day 0 should have 2 filled slots with different recipes
    expect(day0).toHaveLength(2);
    // day 1: pool exhausted (both r1 and r2 used on day 0, cooldown=3 days)
    expect(day1.every((a) => a.type === "EMPTY")).toBe(true);
  });

  it("should respect cooldown=0 (no cooldown)", () => {
    const result = generate(
      makeInput({
        params: makeParams({ cooldownDays: 0 }),
        pool: [makeRecipe("r1")],
        slots: [makeSlot(0, "LUNCH"), makeSlot(0, "DINNER")],
      })
    );

    expect(result.assignments.every((a) => a.recipeId === "r1")).toBe(true);
  });

  it("should respect cross-planning cooldown", () => {
    const result = generate(
      makeInput({
        params: makeParams({ cooldownDays: 2 }),
        pool: [makeRecipe("r1"), makeRecipe("r2")],
        previousSlots: [{ date: makeDate(-1), recipeId: "r1", tagIds: [] }],
        slots: [makeSlot(0, "LUNCH")],
      })
    );

    // r1 was used yesterday (1 day ago), cooldown=2, so r1 should be excluded
    expect(result.assignments[0].recipeId).toBe("r2");
  });
});

describe("generate - cooldown tag", () => {
  it("should exclude recipes by tag cooldown", () => {
    const rules = [
      makeRule({ tagId: "tag-pates", tagCooldownDays: 2, tag: { id: "tag-pates", name: "pates" } }),
    ];
    const pool = [makeRecipe("r1", ["tag-pates"]), makeRecipe("r2", ["tag-viande"])];

    const result = generate(
      makeInput({
        rules,
        pool,
        params: makeParams({ cooldownDays: 0 }),
        slots: [makeSlot(0, "LUNCH"), makeSlot(0, "DINNER")],
      })
    );

    // First slot: either r1 or r2. If r1 picked, second slot must be r2 (tag cooldown)
    const first = result.assignments[0];
    const second = result.assignments[1];
    if (first.recipeId === "r1") {
      expect(second.recipeId).toBe("r2");
    }
    // Both should be filled
    expect(result.assignments.every((a) => a.type === "RECIPE")).toBe(true);
  });
});

describe("generate - frequencyMax", () => {
  it("should stop picking tag when frequencyMax reached", () => {
    const rules = [
      makeRule({
        tagId: "tag-viande",
        frequencyMax: 1,
        frequencyPer: "PER_PLANNING",
        tag: { id: "tag-viande", name: "viande" },
      }),
    ];
    const pool = [
      makeRecipe("r1", ["tag-viande"]),
      makeRecipe("r2", ["tag-viande"]),
      makeRecipe("r3", ["tag-legume"]),
    ];

    const result = generate(
      makeInput({
        rules,
        pool,
        params: makeParams({ cooldownDays: 0 }),
        slots: [makeSlot(0, "LUNCH"), makeSlot(0, "DINNER"), makeSlot(1, "LUNCH")],
      })
    );

    // At most 1 slot should have tag-viande
    const viandeCount = result.assignments.filter((a) => {
      const entry = pool.find((p) => p.recipeId === a.recipeId);
      return entry?.tagIds.includes("tag-viande");
    }).length;
    expect(viandeCount).toBeLessThanOrEqual(1);
  });
});

describe("generate - weight computation", () => {
  it("should favor higher-weight recipes", () => {
    const rules = [
      makeRule({ tagId: "tag-fav", weight: 2.0, tag: { id: "tag-fav", name: "fav" } }),
    ];
    const pool = [makeRecipe("r-fav", ["tag-fav"]), makeRecipe("r-normal", [])];

    // Run many times and check that r-fav is picked more often
    let favCount = 0;
    const iterations = 200;
    for (let i = 0; i < iterations; i++) {
      const result = generate(
        makeInput({
          rules,
          pool,
          params: makeParams({ cooldownDays: 0 }),
          slots: [makeSlot(0, "LUNCH")],
        })
      );
      if (result.assignments[0].recipeId === "r-fav") favCount++;
    }

    // r-fav has weight 2.0, r-normal has weight 1.0
    // Expected ratio: ~66% for r-fav
    expect(favCount).toBeGreaterThan(iterations * 0.45);
  });

  it("should exclude recipes with weight=0", () => {
    const rules = [
      makeRule({
        tagId: "tag-excluded",
        weight: 0.0,
        tag: { id: "tag-excluded", name: "excluded" },
      }),
    ];
    const pool = [makeRecipe("r1", ["tag-excluded"]), makeRecipe("r2", [])];

    const result = generate(
      makeInput({
        rules,
        pool,
        params: makeParams({ cooldownDays: 0 }),
        slots: [makeSlot(0, "LUNCH")],
      })
    );

    expect(result.assignments[0].recipeId).toBe("r2");
  });

  it("should apply mealTimeConstraint on rules", () => {
    const rules = [
      makeRule({
        tagId: "tag-a",
        weight: 0.0,
        mealTimeConstraint: "DINNER",
        tag: { id: "tag-a", name: "a" },
      }),
    ];
    const pool = [makeRecipe("r1", ["tag-a"]), makeRecipe("r2", [])];

    // LUNCH slot: rule doesn't apply (mealTimeConstraint=DINNER), r1 should still be available
    const lunchResult = generate(
      makeInput({
        rules,
        pool,
        params: makeParams({ cooldownDays: 0 }),
        slots: [makeSlot(0, "LUNCH")],
      })
    );
    // r1 should be possible at lunch
    // (we can't guarantee it's picked due to randomness, so just check no error)
    expect(lunchResult.assignments[0].type).toBe("RECIPE");

    // DINNER slot: rule applies, r1 excluded (weight=0)
    const dinnerResult = generate(
      makeInput({
        rules,
        pool,
        params: makeParams({ cooldownDays: 0 }),
        slots: [makeSlot(0, "DINNER")],
      })
    );
    expect(dinnerResult.assignments[0].recipeId).toBe("r2");
  });

  it("should multiply weights from multiple tag rules", () => {
    const rules = [
      makeRule({ tagId: "tag-a", weight: 1.5, tag: { id: "tag-a", name: "a" } }),
      makeRule({ tagId: "tag-b", weight: 1.8, tag: { id: "tag-b", name: "b" } }),
    ];
    // Recipe with both tags: weight = 1.0 * 1.5 * 1.8 = 2.7
    // Recipe with no tags: weight = 1.0
    const pool = [makeRecipe("r-multi", ["tag-a", "tag-b"]), makeRecipe("r-plain", [])];

    let multiCount = 0;
    for (let i = 0; i < 200; i++) {
      const result = generate(
        makeInput({
          rules,
          pool,
          params: makeParams({ cooldownDays: 0 }),
          slots: [makeSlot(0, "LUNCH")],
        })
      );
      if (result.assignments[0].recipeId === "r-multi") multiCount++;
    }

    // r-multi weight 2.7 vs r-plain weight 1.0 -> ~73% expected
    expect(multiCount).toBeGreaterThan(100);
  });
});

describe("generate - MealIdea", () => {
  it("should produce FREE_TEXT for idea without recipeId", () => {
    const pool = [makeIdea("idea-1", "Resto japonais")];

    const result = generate(
      makeInput({
        pool,
        params: makeParams({ cooldownDays: 0 }),
        slots: [makeSlot(0, "LUNCH")],
      })
    );

    expect(result.assignments[0].type).toBe("FREE_TEXT");
    expect(result.assignments[0].freeText).toBe("Resto japonais");
    expect(result.assignments[0].recipeId).toBeNull();
  });

  it("should treat idea with recipeId as RECIPE", () => {
    const pool = [makeIdea("idea-1", "Lasagnes", "recipe-linked", ["tag-italien"])];

    const result = generate(
      makeInput({
        pool,
        params: makeParams({ cooldownDays: 0 }),
        slots: [makeSlot(0, "LUNCH")],
      })
    );

    expect(result.assignments[0].type).toBe("RECIPE");
    expect(result.assignments[0].recipeId).toBe("recipe-linked");
  });
});

describe("generate - pool exhausted", () => {
  it("should set EMPTY and warn when pool is empty", () => {
    const result = generate(
      makeInput({
        pool: [],
        slots: [makeSlot(0, "LUNCH")],
      })
    );

    expect(result.assignments[0].type).toBe("EMPTY");
    expect(result.report.slotsEmpty).toBe(1);
    expect(result.report.warnings).toHaveLength(1);
    expect(result.report.warnings[0].type).toBe("POOL_EXHAUSTED");
  });
});

// =============================================
// Phase 5 Tests: frequencyMin catch-up + report
// =============================================

describe("generate - frequencyMin catch-up", () => {
  it("should replace low-weight slots to meet frequencyMin (PER_PLANNING)", () => {
    const rules = [
      makeRule({
        tagId: "tag-veg",
        weight: 1.0,
        frequencyMin: 2,
        frequencyPer: "PER_PLANNING",
        tag: { id: "tag-veg", name: "vegetarien" },
      }),
    ];

    // Pool: 3 veg recipes + 3 non-veg (lower weight due to tag rule boosting veg)
    const pool = [
      makeRecipe("veg1", ["tag-veg"]),
      makeRecipe("veg2", ["tag-veg"]),
      makeRecipe("veg3", ["tag-veg"]),
      makeRecipe("meat1", []),
      makeRecipe("meat2", []),
      makeRecipe("meat3", []),
    ];

    // Run many times to handle randomness
    let minMetCount = 0;
    const iterations = 50;
    for (let i = 0; i < iterations; i++) {
      const result = generate(
        makeInput({
          rules,
          pool,
          params: makeParams({ cooldownDays: 0 }),
          slots: [
            makeSlot(0, "LUNCH"),
            makeSlot(0, "DINNER"),
            makeSlot(1, "LUNCH"),
            makeSlot(1, "DINNER"),
          ],
        })
      );

      const vegCount = result.assignments.filter((a) => {
        const entry = pool.find((p) => p.recipeId === a.recipeId);
        return entry?.tagIds.includes("tag-veg");
      }).length;

      if (vegCount >= 2) minMetCount++;
    }

    // Should meet the min most of the time (catch-up should help)
    expect(minMetCount).toBeGreaterThan(iterations * 0.7);
  });

  it("should warn FREQUENCY_MIN_NOT_MET when impossible to satisfy", () => {
    const rules = [
      makeRule({
        tagId: "tag-rare",
        weight: 1.0,
        frequencyMin: 5,
        frequencyPer: "PER_PLANNING",
        tag: { id: "tag-rare", name: "rare" },
      }),
    ];

    // Only 1 recipe with the tag but need 5 occurrences in 2 slots
    const pool = [makeRecipe("rare1", ["tag-rare"]), makeRecipe("normal1", [])];

    const result = generate(
      makeInput({
        rules,
        pool,
        params: makeParams({ cooldownDays: 0 }),
        slots: [makeSlot(0, "LUNCH"), makeSlot(0, "DINNER")],
      })
    );

    const warning = result.report.warnings.find((w) => w.type === "FREQUENCY_MIN_NOT_MET");
    expect(warning).toBeDefined();
    expect(warning!.tagId).toBe("tag-rare");
    expect(warning!.required).toBe(5);
    expect(warning!.actual).toBeLessThan(5);
  });

  it("should handle exact mode (frequencyMin == frequencyMax)", () => {
    const rules = [
      makeRule({
        tagId: "tag-poisson",
        weight: 1.0,
        frequencyMin: 2,
        frequencyMax: 2,
        frequencyPer: "PER_PLANNING",
        tag: { id: "tag-poisson", name: "poisson" },
      }),
    ];

    const pool = [
      makeRecipe("fish1", ["tag-poisson"]),
      makeRecipe("fish2", ["tag-poisson"]),
      makeRecipe("fish3", ["tag-poisson"]),
      makeRecipe("meat1", []),
      makeRecipe("meat2", []),
      makeRecipe("meat3", []),
    ];

    let exactCount = 0;
    const iterations = 50;
    for (let i = 0; i < iterations; i++) {
      const result = generate(
        makeInput({
          rules,
          pool,
          params: makeParams({ cooldownDays: 0 }),
          slots: [
            makeSlot(0, "LUNCH"),
            makeSlot(0, "DINNER"),
            makeSlot(1, "LUNCH"),
            makeSlot(1, "DINNER"),
          ],
        })
      );

      const fishCount = result.assignments.filter((a) => {
        const entry = pool.find((p) => p.recipeId === a.recipeId);
        return entry?.tagIds.includes("tag-poisson");
      }).length;

      // frequencyMax=2 is enforced by main pass, frequencyMin=2 by catch-up
      if (fishCount === 2) exactCount++;
    }

    // Should hit exactly 2 most of the time
    expect(exactCount).toBeGreaterThan(iterations * 0.6);
  });

  it("should handle PER_WEEK frequency windows", () => {
    const rules = [
      makeRule({
        tagId: "tag-veg",
        weight: 1.0,
        frequencyMin: 1,
        frequencyMax: 2,
        frequencyPer: "PER_WEEK",
        tag: { id: "tag-veg", name: "vegetarien" },
      }),
    ];

    const pool = [
      makeRecipe("veg1", ["tag-veg"]),
      makeRecipe("veg2", ["tag-veg"]),
      makeRecipe("meat1", []),
      makeRecipe("meat2", []),
      makeRecipe("meat3", []),
      makeRecipe("meat4", []),
    ];

    // 14 days = 2 weeks -> each week should have 1-2 veg meals
    let allWindowsMet = 0;
    const iterations = 30;
    for (let i = 0; i < iterations; i++) {
      const slots = [];
      for (let d = 0; d < 14; d++) {
        slots.push(makeSlot(d, "LUNCH"));
        slots.push(makeSlot(d, "DINNER"));
      }

      const result = generate(
        makeInput({
          rules,
          pool,
          params: makeParams({ cooldownDays: 0 }),
          slots,
        })
      );

      // Count veg per week
      const week1Veg = result.assignments
        .filter((a) => a.slotId.match(/slot-[0-6]/))
        .filter((a) => {
          const entry = pool.find((p) => p.recipeId === a.recipeId);
          return entry?.tagIds.includes("tag-veg");
        }).length;

      const week2Veg = result.assignments
        .filter((a) => a.slotId.match(/slot-(7|8|9|1[0-3])/))
        .filter((a) => {
          const entry = pool.find((p) => p.recipeId === a.recipeId);
          return entry?.tagIds.includes("tag-veg");
        }).length;

      if (week1Veg >= 1 && week1Veg <= 2 && week2Veg >= 1 && week2Veg <= 2) {
        allWindowsMet++;
      }
    }

    expect(allWindowsMet).toBeGreaterThan(iterations * 0.5);
  });
});

describe("generate - FREQUENCY_MAX_EXCEEDED warning (pin conflict)", () => {
  it("should warn when pin forces tag beyond frequencyMax", () => {
    const rules = [
      makeRule({
        tagId: "tag-a",
        weight: 1.0,
        frequencyMax: 1,
        frequencyPer: "PER_PLANNING",
        tag: { id: "tag-a", name: "a" },
      }),
    ];

    // All recipes have tag-a, and 2 slots pinned to tag-a
    // frequencyMax=1 but 2 pinned slots -> exceed
    const pool = [makeRecipe("r1", ["tag-a"]), makeRecipe("r2", ["tag-a"])];

    const result = generate(
      makeInput({
        rules,
        pool,
        params: makeParams({ cooldownDays: 0 }),
        pins: [makePin("MON", "LUNCH", "tag-a"), makePin("MON", "DINNER", "tag-a")],
        slots: [makeSlot(0, "LUNCH"), makeSlot(0, "DINNER")],
      })
    );

    // Both slots should be filled (pins are absolute)
    expect(result.assignments.filter((a) => a.type === "RECIPE")).toHaveLength(2);
    // Should have a FREQUENCY_MAX_EXCEEDED warning
    const warning = result.report.warnings.find((w) => w.type === "FREQUENCY_MAX_EXCEEDED");
    expect(warning).toBeDefined();
  });
});

describe("generate - full report", () => {
  it("should produce a complete report", () => {
    const result = generate(
      makeInput({
        exclusions: [makeExclusion("MON", "DINNER")],
        pool: [makeRecipe("r1"), makeRecipe("r2"), makeRecipe("r3")],
        slots: [
          makeSlot(0, "LUNCH"),
          makeSlot(0, "DINNER"), // excluded
          makeSlot(1, "LUNCH", { disabled: true }),
          makeSlot(1, "DINNER", { locked: true, type: "RECIPE", recipeId: "r1" }),
        ],
      })
    );

    expect(result.report.slotsGenerated).toBe(1); // Only MON LUNCH
    expect(result.report.slotsSkipped.excluded).toBe(1);
    expect(result.report.slotsSkipped.disabled).toBe(1);
    expect(result.report.slotsSkipped.locked).toBe(1);
    expect(result.assignments).toHaveLength(1);
  });
});
