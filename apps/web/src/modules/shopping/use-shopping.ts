// Ecritures de la liste de courses [D228, D231] : la liste en cache change tout de
// suite (cocher en magasin ne doit pas attendre le reseau), puis elle est relue.
import {
  listSchema,
  shoppingItemSchema,
  type CreateShoppingItemBody,
  type RestoreShoppingItemsBody,
  type ShoppingItem,
  type ShoppingList,
  type UpdateShoppingItemBody,
} from "@fm/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { errorMessage } from "../../i18n/index.ts";
import { api, isNetworkError } from "../../lib/api.ts";
import { useToast } from "../../ui/use-toast.ts";
import { itemName } from "./entry.ts";
import { queueCheck } from "./pending-checks.ts";
import { listQuery } from "./queries.ts";

/** Articles d'une section dans l'ordre affiche : a acheter, puis achetes. */
export function sectionItems(items: readonly ShoppingItem[], sectionId: string | null) {
  return items
    .filter((item) => item.sectionId === sectionId)
    .sort(
      (a, b) =>
        Number(a.checkedAt !== null) - Number(b.checkedAt !== null) || a.sortOrder - b.sortOrder
    );
}

/** Cible du glisser posee sur le titre d'une section ("others" : Autres). */
export const sectionDropId = (sectionId: string | null) => `section:${sectionId ?? "others"}`;

export interface Move {
  itemId: string;
  /** Section de depart et d'arrivee. */
  from: string | null;
  sectionId: string | null;
  /** Ordre complet de la section d'arrivee ; absent : en fin, place donnee par l'API. */
  ids?: string[];
}

/**
 * Article lache sur un autre (il prend sa place, a la suite des articles a acheter si
 * l'autre est achete) ou sur le titre d'une section (en fin de ses articles a acheter).
 * Null si rien ne change.
 */
export function dropMove(
  items: readonly ShoppingItem[],
  sourceId: string,
  targetId: string
): Move | null {
  const item = items.find((i) => i.id === sourceId);
  if (!item) return null;
  const onSection = targetId.startsWith("section:");
  const target = onSection ? undefined : items.find((i) => i.id === targetId);
  if (!onSection && !target) return null;
  let sectionId: string | null;
  if (target) sectionId = target.sectionId;
  else sectionId = targetId === sectionDropId(null) ? null : targetId.slice("section:".length);
  const moved = sectionId !== item.sectionId;
  if (moved && !target) return { itemId: item.id, from: item.sectionId, sectionId };

  const ordered = sectionItems(items, sectionId);
  const others = ordered.filter((i) => i.id !== item.id);
  const toBuy = others.filter((i) => i.checkedAt === null);
  let at = toBuy.length;
  if (target && target.checkedAt === null) {
    at = toBuy.indexOf(target);
    // Vers le bas dans la section : il prend la place de l'autre, donc apres lui.
    if (!moved && ordered.indexOf(item) < ordered.indexOf(target)) at += 1;
  }
  const ids = [
    ...toBuy.slice(0, at),
    item,
    ...toBuy.slice(at),
    ...others.filter((i) => i.checkedAt !== null),
  ].map((i) => i.id);
  if (!moved && ids.every((id, index) => ordered[index]?.id === id)) return null;
  return { itemId: item.id, from: item.sectionId, sectionId, ids };
}

/** Corps de l'Annuler : l'article tel qu'il etait, avec son id. */
function toRestore(item: ShoppingItem): RestoreShoppingItemsBody["items"][number] {
  return {
    id: item.id,
    sectionId: item.sectionId,
    ingredientId: item.ingredient?.id ?? null,
    label: item.ingredient ? null : item.label,
    parts: item.parts,
    sortOrder: item.sortOrder,
    checkedAt: item.checkedAt,
    sources: item.sources.map(({ mealSlotId, recipeId, recipeTitle, date, mealTime, parts }) => ({
      mealSlotId,
      recipeId,
      recipeTitle,
      date,
      mealTime,
      parts,
    })),
  };
}

function patched(item: ShoppingItem, body: UpdateShoppingItemBody, items: ShoppingItem[]) {
  const next = { ...item };
  if (body.parts) next.parts = body.parts;
  if (body.checked !== undefined) {
    next.checkedAt = body.checked ? (body.checkedChangedAt ?? new Date().toISOString()) : null;
  }
  if (body.sectionId !== undefined && body.sectionId !== item.sectionId) {
    // Fin des articles de la section d'arrivee, comme l'API.
    const orders = items.filter((i) => i.sectionId === body.sectionId).map((i) => i.sortOrder);
    next.sectionId = body.sectionId;
    next.sortOrder = Math.max(-1, ...orders) + 1;
  }
  return next;
}

export function useShopping(spaceId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { queryKey } = listQuery(spaceId);
  const base = `/spaces/${spaceId}/shopping`;

  const edit = (change: (list: ShoppingList) => ShoppingList) => {
    queryClient.setQueryData(queryKey, (list) => (list ? change(list) : list));
  };
  const refresh = () => queryClient.invalidateQueries({ queryKey });
  const onError = (error: unknown) => {
    toast(errorMessage(error), { tone: "danger" });
  };

  const create = useMutation({
    mutationFn: (body: CreateShoppingItemBody) =>
      api.post(`${base}/items`, body, shoppingItemSchema),
    onSuccess: (item) => {
      edit((list) => ({ ...list, items: [...list.items.filter((i) => i.id !== item.id), item] }));
    },
    onError,
    onSettled: refresh,
  });

  const update = useMutation({
    mutationFn: ({ itemId, body }: { itemId: string; body: UpdateShoppingItemBody }) =>
      api.patch(`${base}/items/${itemId}`, body, shoppingItemSchema),
    onMutate: async ({ itemId, body }) => {
      await queryClient.cancelQueries({ queryKey });
      edit((list) => ({
        ...list,
        items: list.items.map((item) =>
          item.id === itemId ? patched(item, body, list.items) : item
        ),
      }));
    },
    onError: (error, { itemId, body }) => {
      // Reseau coupe pendant une coche (magasin) : elle attend le retour du reseau.
      if (
        body.checked !== undefined &&
        body.checkedChangedAt &&
        (isNetworkError(error) || !navigator.onLine)
      ) {
        queueCheck(spaceId, itemId, body.checked, body.checkedChangedAt);
        return;
      }
      onError(error);
    },
    onSettled: refresh,
  });

  const restore = useMutation({
    mutationFn: (items: ShoppingItem[]) =>
      api.post(
        `${base}/items/restore`,
        { items: items.map(toRestore) },
        listSchema(shoppingItemSchema)
      ),
    onError,
    onSettled: refresh,
  });

  const remove = useMutation({
    mutationFn: (item: ShoppingItem) => api.delete(`${base}/items/${item.id}`),
    onMutate: async (item) => {
      await queryClient.cancelQueries({ queryKey });
      edit((list) => ({ ...list, items: list.items.filter((i) => i.id !== item.id) }));
    },
    onSuccess: (_, item) => {
      toast(`« ${itemName(item)} » retiré de la liste`, {
        action: {
          label: "Annuler",
          onAction: () => {
            restore.mutate([item]);
          },
        },
      });
    },
    onError,
    onSettled: refresh,
  });

  // "Retirer les achetes" : sans confirmation, Annuler remet les articles tels quels.
  const clear = useMutation({
    mutationFn: () => api.post(`${base}/checked/clear`, {}, listSchema(shoppingItemSchema)),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });
      edit((list) => ({ ...list, items: list.items.filter((i) => i.checkedAt === null) }));
    },
    onSuccess: ({ data }) => {
      if (data.length === 0) return;
      const n = data.length;
      toast(n > 1 ? `${String(n)} articles retirés` : "1 article retiré", {
        action: {
          label: "Annuler",
          onAction: () => {
            restore.mutate(data);
          },
        },
      });
    },
    onError,
    onSettled: refresh,
  });

  const reorder = useMutation({
    mutationFn: ({ sectionId, ids }: { sectionId: string | null; ids: string[] }) =>
      api.put(`${base}/items/order`, { sectionId, ids }),
    onMutate: async ({ ids }) => {
      await queryClient.cancelQueries({ queryKey });
      const order = new Map(ids.map((id, index) => [id, index]));
      edit((list) => ({
        ...list,
        items: list.items.map((item) => {
          const sortOrder = order.get(item.id);
          return sortOrder === undefined ? item : { ...item, sortOrder };
        }),
      }));
    },
    onError,
    onSettled: refresh,
  });

  // Glisser : la section d'abord (l'API fixe la favorite d'un produit qui n'en a pas), puis
  // l'ordre de la section d'arrivee.
  const move = useMutation({
    mutationFn: async ({ itemId, from, sectionId, ids }: Move) => {
      if (from !== sectionId) await api.patch(`${base}/items/${itemId}`, { sectionId });
      if (ids) await api.put(`${base}/items/order`, { sectionId, ids });
    },
    onMutate: async ({ itemId, sectionId, ids }) => {
      await queryClient.cancelQueries({ queryKey });
      const order = new Map((ids ?? []).map((id, index) => [id, index]));
      edit((list) => ({
        ...list,
        items: list.items.map((item) => {
          const next = item.id === itemId ? patched(item, { sectionId }, list.items) : item;
          const sortOrder = order.get(item.id);
          return sortOrder === undefined ? next : { ...next, sortOrder };
        }),
      }));
    },
    onError,
    onSettled: refresh,
  });

  return { create, update, remove, restore, reorder, clear, move };
}
