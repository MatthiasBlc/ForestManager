// F-REC-10 : confirmation de la suppression d'une recette.
import type { Recipe } from "@fm/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { FormAlert } from "../../core/access/auth-layout.tsx";
import { errorMessage } from "../../i18n/index.ts";
import { api } from "../../lib/api.ts";
import { Button } from "../../ui/button.tsx";
import { Sheet, SheetFooter } from "../../ui/sheet.tsx";
import { useToast } from "../../ui/use-toast.ts";
import { joinNames } from "./format.ts";
import { recipeQuery, recipesKey } from "./queries.ts";

export function DeleteSheet({
  spaceId,
  recipe,
  open,
  onClose,
  onDone,
}: {
  spaceId: string;
  recipe: Recipe;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [failure, setFailure] = useState<string>();
  const [pending, setPending] = useState(false);
  const confirm = async () => {
    setPending(true);
    try {
      await api.delete(`/spaces/${spaceId}/recipes/${recipe.id}`);
      queryClient.removeQueries({ queryKey: recipeQuery(spaceId, recipe.id).queryKey });
      await queryClient.invalidateQueries({ queryKey: [...recipesKey(spaceId), "list"] });
      toast("Recette supprimée", { tone: "success" });
      onDone();
    } catch (error) {
      setFailure(errorMessage(error));
      setPending(false);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title={`Supprimer « ${recipe.title} » ?`}>
      <p>La recette et son historique disparaissent pour tous les membres de l'espace.</p>
      {recipe.sharedIn.length > 0 ? (
        <p>Elle disparaît aussi de {joinNames(recipe.sharedIn.map((space) => space.name))}.</p>
      ) : null}
      {recipe.usedBy > 0 ? (
        <p>
          Elle est utilisée dans {recipe.usedBy} {recipe.usedBy > 1 ? "recettes" : "recette"} :
          leurs blocs afficheront « Recette supprimée ».
        </p>
      ) : null}
      <FormAlert message={failure} />
      <SheetFooter>
        <Button onClick={onClose}>Annuler</Button>
        <Button variant="danger" disabled={pending} onClick={() => void confirm()}>
          Supprimer
        </Button>
      </SheetFooter>
    </Sheet>
  );
}
