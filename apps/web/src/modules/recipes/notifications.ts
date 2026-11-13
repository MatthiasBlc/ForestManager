// Messages des notifications et de l'activite du module Recettes (C6.5, D34).
import type { Notification } from "@fm/shared";

import type { ActivityRenderer, NotificationRenderer } from "../../app/registry.ts";
import { others } from "../../core/notifications/others.ts";

function text(data: Record<string, unknown> | null, key: string): string {
  const value = data?.[key];
  return typeof value === "string" ? value : "";
}

const title = (n: Notification) => `« ${text(n.data, "title")} »`;
const recipePath = (n: Notification) =>
  n.space ? `/s/${n.space.id}/recipes/${text(n.data, "recipeId")}` : null;

export const RECIPE_NOTIFICATIONS: Record<string, NotificationRenderer> = {
  "recipes.suggestion.created": (n) => ({
    text: `propose une modification de ${title(n)}.`,
    to: recipePath(n),
  }),
  "recipes.suggestion.accepted": (n) => ({
    text: `a accepté ta suggestion sur ${title(n)}.`,
    to: recipePath(n),
  }),
  "recipes.suggestion.rejected": (n) => {
    const message = text(n.data, "message");
    return {
      text: `a refusé ta suggestion sur ${title(n)}${message ? ` : ${message}` : "."}`,
      to: recipePath(n),
    };
  },
  "recipes.share-request.created": (n) => ({
    text: `voudrait partager ta recette ${title(n)} dans ${text(n.data, "targetSpaceName")}.`,
    // Le bandeau des demandes est sur la liste de l'espace, "Mes recettes" en perso.
    to: n.space ? `/s/${n.space.id}/recipes${n.data?.personal === true ? "/mine" : ""}` : null,
  }),
  "recipes.share-request.approved": (n) => ({
    text: `a partagé ${title(n)} dans ${text(n.data, "targetSpaceName")}.`,
    to: `/s/${text(n.data, "targetSpaceId")}/recipes/${text(n.data, "recipeId")}`,
  }),
  "recipes.share-request.rejected": (n) => ({
    text: `a refusé de partager ${title(n)} dans ${text(n.data, "targetSpaceName")}.`,
    to: null,
  }),
  "recipes.recipe.adapted": (n) => ({
    text: `a adapté ta recette ${title(n)} dans ${text(n.data, "spaceName")}.`,
    to: recipePath(n),
  }),
  "recipes.recipe.created": (n) =>
    n.count > 1
      ? {
          text: `${others(n)}ont ajouté des recettes dans ${n.space?.name ?? ""}.`,
          to: n.space ? `/s/${n.space.id}/recipes` : null,
        }
      : { text: `a ajouté ${title(n)} dans ${n.space?.name ?? ""}.`, to: recipePath(n) },
};

export const RECIPE_ACTIVITY: Record<string, ActivityRenderer> = {
  "recipes.recipe.created": (event, spaceId) => ({
    text: `a ajouté « ${text(event.data, "title")} ».`,
    to: event.targetId ? `/s/${spaceId}/recipes/${event.targetId}` : null,
  }),
  "recipes.recipe.shared": (event, spaceId) => ({
    text: `a partagé « ${text(event.data, "title")} ».`,
    to: event.targetId ? `/s/${spaceId}/recipes/${event.targetId}` : null,
  }),
  // "Depuis mes recettes" : une ligne par lot, les trois premiers titres [D208].
  "recipes.recipes.added": (event, spaceId) => {
    const count = Number(event.data?.count ?? 0);
    const raw = event.data?.titles;
    const titles = Array.isArray(raw) ? raw.map((t) => `« ${String(t)} »`) : [];
    return {
      text: `a ajouté ${String(count)} recettes : ${titles.join(", ")}${count > titles.length ? "…" : "."}`,
      to: `/s/${spaceId}/recipes`,
    };
  },
};
