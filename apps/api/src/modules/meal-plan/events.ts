// Notifications et activite du Planning (C6.5) [P10, D41]. Pas d'avis par repas
// au-dela du regroupement : "Lea a modifie 3 repas du planning" sur 24 h.
import { recordActivity } from "../../core/activity/service.ts";
import type { Context } from "../../core/context.ts";
import { activeMembers } from "../../core/notifications/recipients.ts";
import { notify } from "../../core/notifications/service.ts";

const MODULE = "meal-plan";

export async function mealChanged(ctx: Context, spaceId: string, userId: string): Promise<void> {
  await notify(ctx, {
    type: "meal-plan.meal.changed",
    recipients: await activeMembers(ctx.db, spaceId),
    spaceId,
    moduleCode: MODULE,
    actorId: userId,
    groupKey: `meal-plan.meal.changed:${spaceId}`,
  });
}

export async function planGenerated(
  ctx: Context,
  spaceId: string,
  userId: string,
  dates: readonly string[]
): Promise<void> {
  if (dates.length === 0) return;
  const sorted = [...dates].sort();
  const data = { from: sorted[0], to: sorted.at(-1), count: dates.length };
  await recordActivity(ctx, {
    spaceId,
    type: "meal-plan.plan.generated",
    moduleCode: MODULE,
    actorId: userId,
    data,
  });
  await notify(ctx, {
    type: "meal-plan.plan.generated",
    recipients: await activeMembers(ctx.db, spaceId),
    spaceId,
    moduleCode: MODULE,
    actorId: userId,
    data,
  });
}
