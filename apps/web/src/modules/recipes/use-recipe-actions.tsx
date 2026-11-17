// Actions d'une recette, communes au "..." du detail et a l'appui long sur une
// carte (F-ACTIONS) : liste selon les droits et feuilles de chaque action
// (supprimer F-REC-10, partager, adapter, retirer F-REC-9).
import type { Recipe } from "@fm/shared";
import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router";

import { meQuery, spaceQuery } from "../../core/session/queries.ts";
import type { ActionItem } from "../../ui/action-menu.tsx";
import { AdaptSheet } from "./adaptation.tsx";
import { DeleteSheet } from "./delete-sheet.tsx";
import { RemoveFromSpaceSheet, ShareSheet } from "./sharing.tsx";

export type RecipeAction =
  "edit" | "share" | "suggest" | "adapt" | "compare" | "history" | "remove" | "delete";

type SheetAction = Extract<RecipeAction, "share" | "adapt" | "remove" | "delete">;

/**
 * Actions de `recipe` vue dans `spaceId`. `withEdit` ajoute "Modifier" (la carte ;
 * le detail a son propre bouton). `onGone` suit une suppression ou un retrait
 * reussi ; `onClosed` suit la fermeture d'une feuille d'action.
 */
export function useRecipeActions({
  spaceId,
  recipe,
  withEdit = false,
  onGone,
  onClosed,
}: {
  spaceId: string;
  recipe: Recipe | undefined;
  withEdit?: boolean;
  onGone: () => void;
  onClosed?: () => void;
}): {
  items: (ActionItem<RecipeAction> | "-")[];
  select: (id: RecipeAction) => void;
  sheets: ReactNode;
} {
  const navigate = useNavigate();
  const { data: me } = useQuery(meQuery);
  const { data: space } = useQuery(spaceQuery(spaceId));
  const [sheet, setSheet] = useState<SheetAction | null>(null);
  if (!recipe) return { items: [], select: () => undefined, sheets: null };

  const spaceName = space?.name ?? "";
  const sharedHere = recipe.homeSpaceId !== spaceId;
  const items: (ActionItem<RecipeAction> | "-")[] = [
    ...(withEdit && recipe.can.edit
      ? [{ id: "edit" as const, label: "Modifier", icon: "pencil" as const }]
      : []),
    { id: "share", label: "Partager dans un espace", icon: "share" },
    ...(me && recipe.author.id !== me.id
      ? [{ id: "suggest" as const, label: "Suggérer une modification", icon: "pencil" as const }]
      : []),
    { id: "adapt", label: "Adapter pour un espace", icon: "git-branch" },
    ...(recipe.adaptedFrom && !recipe.adaptedFrom.deleted
      ? [{ id: "compare" as const, label: "Comparer avec l'original", icon: "copy" as const }]
      : []),
    { id: "history", label: "Voir l'historique", icon: "clock" },
    ...(recipe.can.removeFromSpace && sharedHere
      ? [{ id: "remove" as const, label: `Retirer de ${spaceName}`, icon: "x" as const }]
      : []),
    ...(recipe.can.delete
      ? [
          "-" as const,
          { id: "delete" as const, label: "Supprimer", icon: "trash" as const, danger: true },
        ]
      : []),
  ];
  const select = (id: RecipeAction) => {
    if (id === "share" || id === "adapt" || id === "remove" || id === "delete") setSheet(id);
    else void navigate(`/s/${spaceId}/recipes/${recipe.id}/${id}`);
  };
  const close = () => {
    setSheet(null);
    onClosed?.();
  };
  const gone = () => {
    setSheet(null);
    onGone();
  };
  const sheets = (
    <>
      <DeleteSheet
        spaceId={spaceId}
        recipe={recipe}
        open={sheet === "delete"}
        onClose={close}
        onDone={gone}
      />
      <ShareSheet spaceId={spaceId} recipe={recipe} open={sheet === "share"} onClose={close} />
      <AdaptSheet spaceId={spaceId} recipe={recipe} open={sheet === "adapt"} onClose={close} />
      <RemoveFromSpaceSheet
        spaceId={spaceId}
        spaceName={spaceName}
        recipe={recipe}
        open={sheet === "remove"}
        onClose={close}
        onDone={gone}
      />
    </>
  );
  return { items, select, sheets };
}
