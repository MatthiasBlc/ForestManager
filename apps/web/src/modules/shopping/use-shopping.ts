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
import { api } from "../../lib/api.ts";
import { useToast } from "../../ui/use-toast.ts";
import { itemName } from "./entry.ts";
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
    onError,
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

  return { create, update, remove, restore, reorder };
}
