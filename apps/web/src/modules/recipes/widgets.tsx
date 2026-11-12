// Widget d'accueil des Recettes [D193] : recemment ajoutees dans ses espaces.
import { recentRecipesWidgetSchema } from "@fm/shared";
import { useNavigate } from "react-router";

import { RecipeCard, type CardBadge } from "./components/recipe-card.tsx";

export function RecentRecipes({ data }: { data: Record<string, unknown> }) {
  const navigate = useNavigate();
  const parsed = recentRecipesWidgetSchema.safeParse(data);
  if (!parsed.success) return null;
  if (parsed.data.recipes.length === 0) {
    return <p className="m-0 text-ink-muted">Aucune recette ajoutée récemment dans tes espaces.</p>;
  }
  return (
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
          />
        );
      })}
    </div>
  );
}
