import type { ActivityEvent } from "@fm/shared";
import { describe, expect, it } from "vitest";

import { renderActivity } from "../../core/activity/messages.ts";

const SPACE_ID = "6f1c2b8e-3d4a-4f5b-9c6d-7e8f9a0b1c2d";

function buildEvent(data: Record<string, unknown>): ActivityEvent {
  return {
    id: crypto.randomUUID(),
    type: "shopping.list.generated",
    moduleCode: "shopping",
    actor: { id: crypto.randomUUID(), username: "lea", avatarUrl: null },
    targetType: null,
    targetId: null,
    data,
    createdAt: new Date().toISOString(),
  };
}

describe("activite de la liste de courses [D228]", () => {
  it("dit combien d'articles sont venus du planning et ouvre la liste", () => {
    expect(
      renderActivity(buildEvent({ from: "2026-11-24", to: "2026-11-29", count: 7 }), SPACE_ID)
    ).toEqual({
      text: "a ajouté 7 articles à la liste depuis le planning.",
      to: `/s/${SPACE_ID}/shopping`,
    });
  });

  it("accorde au singulier", () => {
    expect(renderActivity(buildEvent({ count: 1 }), SPACE_ID).text).toBe(
      "a ajouté 1 article à la liste depuis le planning."
    );
  });
});
