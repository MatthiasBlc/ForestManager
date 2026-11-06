// F-ACTIONS : feuille d'actions d'une carte de recette (appui long, clic droit,
// touche Menu), memes actions que le "..." du detail.
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { FormAlert } from "../../core/access/auth-layout.tsx";
import { errorMessage } from "../../i18n/index.ts";
import { useWriteGuard } from "../../pwa/use-write-guard.ts";
import { ActionList } from "../../ui/action-menu.tsx";
import { Skeleton } from "../../ui/display.tsx";
import { Sheet } from "../../ui/sheet.tsx";
import { recipeQuery } from "./queries.ts";
import { useRecipeActions } from "./use-recipe-actions.tsx";

/**
 * F-ACTIONS : actions d'une carte, ouvertes par un appui long. La recette est
 * lue dans `spaceId` (son origine depuis "Mes recettes"). La feuille se ferme au
 * choix d'une action ; `onClose` suit la fin de l'action.
 */
export function RecipeActionsSheet({
  spaceId,
  recipeId,
  title,
  onClose,
  onGone,
}: {
  spaceId: string;
  recipeId: string;
  title: string;
  onClose: () => void;
  onGone: () => void;
}) {
  const recipe = useQuery(recipeQuery(spaceId, recipeId));
  const guard = useWriteGuard();
  const [menuOpen, setMenuOpen] = useState(true);
  const actions = useRecipeActions({
    spaceId,
    recipe: recipe.data,
    withEdit: true,
    onGone: () => {
      onGone();
      onClose();
    },
    onClosed: onClose,
  });
  return (
    <>
      <Sheet open={menuOpen} onClose={onClose} title={title}>
        {recipe.data ? (
          <ActionList
            label={`Actions pour ${title}`}
            items={actions.items}
            disabled={guard.disabled}
            onSelect={(id) => {
              setMenuOpen(false);
              actions.select(id);
            }}
          />
        ) : recipe.isError ? (
          <FormAlert message={errorMessage(recipe.error)} />
        ) : (
          <Skeleton label="Chargement des actions…" />
        )}
      </Sheet>
      {actions.sheets}
    </>
  );
}
