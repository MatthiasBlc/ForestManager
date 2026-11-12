// Widgets d'accueil du Planning [D193] : prochains repas par espace, recettes
// les plus cuisinees (D39).
import { mostCookedWidgetSchema, upcomingMealsWidgetSchema, type MealTime } from "@fm/shared";
import { Link, useNavigate } from "react-router";

import { addDays, todayIso, whenLabel } from "./dates.ts";
import { MEAL_TIME_WORDS } from "./format.ts";
import { MealSlot } from "./meal-slot.tsx";

/** "Aujourd'hui, midi", "Demain, soir", sinon "Mardi 3, midi". */
function relativeWhen(date: string, mealTime: MealTime): string {
  const today = todayIso();
  if (date === today) return `Aujourd'hui, ${MEAL_TIME_WORDS[mealTime]}`;
  if (date === addDays(today, 1)) return `Demain, ${MEAL_TIME_WORDS[mealTime]}`;
  return whenLabel(date, mealTime);
}

export function Upcoming({ data }: { data: Record<string, unknown> }) {
  const navigate = useNavigate();
  const parsed = upcomingMealsWidgetSchema.safeParse(data);
  if (!parsed.success) return null;
  return (
    <div className="fm-stack">
      {parsed.data.spaces.map((space) => (
        <div key={space.spaceId} className="fm-stack gap-2">
          <p className="m-0 text-sm font-semibold text-ink-muted">{space.spaceName}</p>
          {space.meals.length === 0 ? (
            <p className="m-0 text-ink-muted">
              Rien de prévu ces prochains jours.{" "}
              <Link to={`/s/${space.spaceId}/meal-plan`}>Ouvrir le planning</Link>
            </p>
          ) : (
            space.meals.map((meal) => (
              <MealSlot
                key={`${meal.date}-${meal.mealTime}`}
                kind={meal.recipeId ? "recipe" : "text"}
                title={meal.title}
                when={relativeWhen(meal.date, meal.mealTime)}
                showWhen
                onOpen={() => void navigate(`/s/${space.spaceId}/meal-plan?day=${meal.date}`)}
              />
            ))
          )}
        </div>
      ))}
    </div>
  );
}

export function MostCooked({ data }: { data: Record<string, unknown> }) {
  const parsed = mostCookedWidgetSchema.safeParse(data);
  if (!parsed.success) return null;
  if (parsed.data.recipes.length === 0) {
    return (
      <p className="m-0 text-ink-muted">
        Planifie des repas : tes recettes favorites apparaîtront ici.
      </p>
    );
  }
  return (
    <ol className="fm-options">
      {parsed.data.recipes.map((recipe) => (
        <li key={recipe.id}>
          <Link to={`/s/${recipe.spaceId}/recipes/${recipe.id}`} className="fm-option">
            <span className="fm-option-text">
              <b>{recipe.title}</b>
              <small>
                {recipe.count} fois · {recipe.spaceName}
              </small>
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
