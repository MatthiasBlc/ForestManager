// Widget d'accueil des Recettes [D193] : recemment ajoutees dans ses espaces.
import { recentRecipesWidgetSchema } from "@fm/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";

import { homeQuery } from "../../core/home/queries.ts";
import { RecipeCard, type CardBadge } from "./components/recipe-card.tsx";
import { RecipeActionsSheet } from "./recipe-actions-sheet.tsx";

export function RecentRecipes({ data }: { data: Record<string, unknown> }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // F-ACTIONS : memes actions qu'une carte de liste, lues dans l'espace de la recette.
  const [actionsFor, setActionsFor] = useState<{ id: string; title: string; spaceId: string }>();
  const parsed = recentRecipesWidgetSchema.safeParse(data);
  if (!parsed.success) return null;
  if (parsed.data.recipes.length === 0) {
    return <p className="m-0 text-ink-muted">Aucune recette ajoutée récemment dans tes espaces.</p>;
  }
  return (
    <>
      <div className="fm-home-cards">
        {parsed.data.recipes.map((recipe) => {
          const badges: CardBadge[] = [
            ...(recipe.isBase ? [{ label: "Base", tone: "second" as const }] : []),
            ...(recipe.adapted ? [{ label: "Adaptée", tone: "accent" as const }] : []),
          ];
          return (
            <RecipeCard
              key={recipe.id}
              title={recipe.title}
              meta={[recipe.spaceName, recipe.author ? `par ${recipe.author}` : null]
                .filter(Boolean)
                .join(" · ")}
              image={recipe.imageUrl}
              badges={badges}
              onOpen={() => void navigate(`/s/${recipe.spaceId}/recipes/${recipe.id}`)}
              onActions={() => {
                setActionsFor({ id: recipe.id, title: recipe.title, spaceId: recipe.spaceId });
              }}
            />
          );
        })}
      </div>
      {actionsFor ? (
        <RecipeActionsSheet
          key={actionsFor.id}
          spaceId={actionsFor.spaceId}
          recipeId={actionsFor.id}
          title={actionsFor.title}
          onClose={() => {
            setActionsFor(undefined);
          }}
          // Supprimee ou retiree : le widget se recharge.
          onGone={() => void queryClient.invalidateQueries({ queryKey: homeQuery.queryKey })}
        />
      ) : null}
    </>
  );
}
