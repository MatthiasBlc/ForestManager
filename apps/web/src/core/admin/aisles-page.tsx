// A07 : rayons. L'ordre est celui de la liste de courses, comme un parcours en
// magasin ; un ingredient sans rayon finit dans "Autres" [D125].
import { AISLE_NAME_MAX, adminAisleSchema, adminAislesSchema, type AdminAisle } from "@fm/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";

import { errorMessage } from "../../i18n/index.ts";
import { api } from "../../lib/api.ts";
import { plural } from "../../lib/plural.ts";
import { Button, IconButton } from "../../ui/button.tsx";
import { Skeleton } from "../../ui/display.tsx";
import { useToast } from "../../ui/use-toast.ts";
import { FormAlert } from "../access/auth-layout.tsx";
import { adminAislesQuery } from "./referential-queries.ts";
import { TranslatedNameSheet, type TranslatedName } from "./translated-name-sheet.tsx";

/** Feuille ouverte : ajout (null) ou modification d'un rayon. */
type Editing = { aisle: AdminAisle | null } | null;

export function AislesPage() {
  const aisles = useQuery(adminAislesQuery);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState<Editing>(null);

  const reorder = useMutation({
    mutationFn: (ids: string[]) => api.put("/admin/aisles/order", { ids }, adminAislesSchema),
    onMutate: (ids) => {
      // L'ordre change tout de suite ; la reponse le confirme.
      queryClient.setQueryData(adminAislesQuery.queryKey, (old) =>
        old
          ? {
              ...old,
              data: ids
                .map((id) => old.data.find((a) => a.id === id))
                .filter((a): a is AdminAisle => a !== undefined),
            }
          : old
      );
    },
    onSuccess: (data) => {
      queryClient.setQueryData(adminAislesQuery.queryKey, data);
    },
    onError: async (error) => {
      toast(errorMessage(error), { tone: "danger" });
      await queryClient.invalidateQueries({ queryKey: adminAislesQuery.queryKey });
    },
  });

  const save = async (aisle: AdminAisle | null, value: TranslatedName) => {
    await (aisle
      ? api.patch(`/admin/aisles/${aisle.id}`, value, adminAisleSchema)
      : api.post("/admin/aisles", value, adminAisleSchema));
    toast(aisle ? `Rayon « ${value.fr} » enregistré` : `Rayon « ${value.fr} » ajouté`, {
      tone: "success",
    });
    await queryClient.invalidateQueries({ queryKey: adminAislesQuery.queryKey });
  };

  const move = (list: AdminAisle[], index: number, by: -1 | 1) => {
    const ids = list.map((a) => a.id);
    const [moved] = ids.splice(index, 1);
    if (moved === undefined) return;
    ids.splice(index + by, 0, moved);
    reorder.mutate(ids);
  };

  return (
    <>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-[1_1_360px] flex-col gap-1">
          <h1 className="m-0 font-display text-2xl font-bold">Rayons</h1>
          <p className="m-0 text-ink-muted">
            Chaque ingrédient a un rayon par défaut. L&apos;ordre ci-dessous est celui de la liste
            de courses, comme un parcours en magasin.
          </p>
        </div>
        <Button
          icon="plus"
          onClick={() => {
            setEditing({ aisle: null });
          }}
        >
          Ajouter un rayon
        </Button>
      </div>
      {aisles.isPending ? (
        <Skeleton label="Chargement des rayons" />
      ) : aisles.isError ? (
        <FormAlert message={errorMessage(aisles.error)} />
      ) : (
        <>
          <ol
            aria-label="Rayons dans l'ordre du magasin"
            className="m-0 flex max-w-2xl list-none flex-col overflow-hidden rounded-lg border border-line bg-surface-raised p-0"
          >
            {aisles.data.data.map((aisle, index, list) => (
              <li
                key={aisle.id}
                className="flex min-h-14 items-center gap-3 border-b border-line px-4 py-2 last:border-b-0"
              >
                <span className="w-6 text-center font-mono text-sm text-ink-muted">
                  {index + 1}
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <b>{aisle.fr}</b>
                  <span className="text-sm text-ink-muted">
                    {aisle.en ?? "À traduire"} ·{" "}
                    {plural(aisle.ingredientCount, "ingrédient", "ingrédients")}
                  </span>
                </div>
                <IconButton
                  icon="arrow-up"
                  label={`Monter ${aisle.fr}`}
                  disabled={index === 0}
                  onClick={() => {
                    move(list, index, -1);
                  }}
                />
                <IconButton
                  icon="arrow-down"
                  label={`Descendre ${aisle.fr}`}
                  disabled={index === list.length - 1}
                  onClick={() => {
                    move(list, index, 1);
                  }}
                />
                <IconButton
                  icon="pencil"
                  label={`Modifier ${aisle.fr}`}
                  onClick={() => {
                    setEditing({ aisle });
                  }}
                />
              </li>
            ))}
          </ol>
          {aisles.data.unclassifiedCount > 0 ? (
            <div
              role="note"
              className="flex max-w-2xl flex-wrap items-center gap-3 rounded-md bg-warning-soft px-4 py-3"
            >
              <span className="flex-[1_1_240px] text-sm">
                <b>
                  {plural(aisles.data.unclassifiedCount, "ingrédient", "ingrédients")} sans rayon.
                </b>{" "}
                Ils apparaîtront dans « Autres » en fin de liste de courses.
              </span>
              <Link
                to="/admin/ingredients?tab=NO_AISLE"
                className="fm-btn fm-btn-secondary no-underline"
              >
                Les classer
              </Link>
            </div>
          ) : null}
        </>
      )}
      <TranslatedNameSheet
        open={editing !== null}
        title={editing?.aisle ? `Modifier « ${editing.aisle.fr} »` : "Ajouter un rayon"}
        submitLabel={editing?.aisle ? "Enregistrer" : "Ajouter"}
        description={editing?.aisle ? undefined : "Il se place en fin de parcours."}
        initial={editing?.aisle ? { fr: editing.aisle.fr, en: editing.aisle.en } : undefined}
        maxLength={AISLE_NAME_MAX}
        onClose={() => {
          setEditing(null);
        }}
        onSubmit={(value) => save(editing?.aisle ?? null, value)}
      />
    </>
  );
}
