// A08 : tags globaux, liste courte commune a tous les espaces et traduite [D34],
// et leurs familles (Saison, Regime...), ordonnees [D216].
// Fusionner deplace les recettes vers l'autre tag ; supprimer retire le tag de
// toutes les recettes. Les tags d'espace se gerent dans chaque espace.
import {
  TAG_FAMILY_NAME_MAX,
  TAG_NAME_MAX,
  adminTagFamilySchema,
  adminTagSchema,
  type AdminTag,
  type AdminTagFamily,
} from "@fm/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";

import { errorMessage } from "../../i18n/index.ts";
import { api } from "../../lib/api.ts";
import { plural } from "../../lib/plural.ts";
import { Button, IconButton } from "../../ui/button.tsx";
import { Badge, Skeleton } from "../../ui/display.tsx";
import { Sheet, SheetFooter } from "../../ui/sheet.tsx";
import { useToast } from "../../ui/use-toast.ts";
import { FormAlert } from "../access/auth-layout.tsx";
import { adminTagFamiliesQuery, adminTagsQuery } from "./referential-queries.ts";
import { TranslatedNameSheet, type TranslatedName } from "./translated-name-sheet.tsx";
import { TableScroll } from "../../ui/table-scroll.tsx";

type Dialog =
  | { kind: "edit"; tag: AdminTag | null }
  | { kind: "merge"; tag: AdminTag }
  | { kind: "delete"; tag: AdminTag }
  | { kind: "edit-family"; family: AdminTagFamily | null }
  | { kind: "delete-family"; family: AdminTagFamily }
  | null;

function recipes(count: number) {
  return plural(count, "recette", "recettes");
}

function MergeTagSheet({
  tag,
  tags,
  onClose,
}: {
  tag: AdminTag | null;
  tags: AdminTag[];
  onClose: () => void;
}) {
  const selectId = useId();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [intoId, setIntoId] = useState("");
  const target = tags.find((t) => t.id === intoId);
  const merge = useMutation({
    mutationFn: () =>
      api.post(`/admin/tags/${tag?.id ?? ""}/merge`, { intoTagId: intoId }, adminTagSchema),
    onSuccess: async (into) => {
      toast(`« ${tag?.fr ?? ""} » fusionné dans « ${into.fr} »`, { tone: "success" });
      setIntoId("");
      onClose();
      await queryClient.invalidateQueries({ queryKey: adminTagsQuery.queryKey });
    },
  });
  return (
    <Sheet open={tag !== null} onClose={onClose} title={`Fusionner « ${tag?.fr ?? ""} »`}>
      <div className="fm-stack">
        <FormAlert message={merge.error ? errorMessage(merge.error) : undefined} />
        <div className="fm-field">
          <label htmlFor={selectId} className="fm-label">
            Fusionner dans
          </label>
          <select
            id={selectId}
            className="fm-input"
            value={intoId}
            onChange={(event) => {
              setIntoId(event.target.value);
            }}
          >
            <option value="">Choisir un tag</option>
            {tags
              .filter((t) => t.id !== tag?.id)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fr}
                </option>
              ))}
          </select>
        </div>
        {target && tag ? (
          <p className="m-0 text-ink-muted">
            Ses {recipes(tag.recipeCount)} passeront à « {target.fr} » et « {tag.fr} » disparaîtra.
            L&apos;opération est enregistrée dans le journal d&apos;audit.
          </p>
        ) : null}
        <SheetFooter>
          <Button onClick={onClose}>Annuler</Button>
          <Button
            variant="primary"
            disabled={!target || merge.isPending}
            onClick={() => {
              merge.mutate();
            }}
          >
            Fusionner
          </Button>
        </SheetFooter>
      </div>
    </Sheet>
  );
}

function DeleteTagSheet({ tag, onClose }: { tag: AdminTag | null; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => api.delete(`/admin/tags/${tag?.id ?? ""}`),
    onSuccess: async () => {
      toast(`Tag « ${tag?.fr ?? ""} » supprimé`);
      onClose();
      await queryClient.invalidateQueries({ queryKey: adminTagsQuery.queryKey });
    },
  });
  return (
    <Sheet open={tag !== null} onClose={onClose} title={`Supprimer « ${tag?.fr ?? ""} » ?`}>
      <div className="fm-stack">
        <FormAlert message={remove.error ? errorMessage(remove.error) : undefined} />
        <p className="m-0 text-ink-muted">
          {tag && tag.recipeCount > 0
            ? `Il sera retiré de ses ${recipes(tag.recipeCount)}.`
            : "Aucune recette ne l'utilise."}{" "}
          L&apos;opération est enregistrée dans le journal d&apos;audit.
        </p>
        <SheetFooter>
          <Button onClick={onClose}>Annuler</Button>
          <Button
            variant="danger"
            disabled={remove.isPending}
            onClick={() => {
              remove.mutate();
            }}
          >
            Supprimer
          </Button>
        </SheetFooter>
      </div>
    </Sheet>
  );
}

function DeleteFamilySheet({
  family,
  onClose,
}: {
  family: AdminTagFamily | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => api.delete(`/admin/tag-families/${family?.id ?? ""}`),
    onSuccess: async () => {
      toast(`Famille « ${family?.fr ?? ""} » supprimée`);
      onClose();
      await queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
  });
  return (
    <Sheet open={family !== null} onClose={onClose} title={`Supprimer « ${family?.fr ?? ""} » ?`}>
      <div className="fm-stack">
        <FormAlert message={remove.error ? errorMessage(remove.error) : undefined} />
        <p className="m-0 text-ink-muted">
          Ses tags restent, sans famille (« Autres » dans les filtres).
        </p>
        <SheetFooter>
          <Button onClick={onClose}>Annuler</Button>
          <Button
            variant="danger"
            disabled={remove.isPending}
            onClick={() => {
              remove.mutate();
            }}
          >
            Supprimer
          </Button>
        </SheetFooter>
      </div>
    </Sheet>
  );
}

/** Familles globales : ordre (monter, descendre), nom traduit, nombre de tags. */
function FamiliesTable({
  families,
  onEdit,
}: {
  families: AdminTagFamily[];
  onEdit: (family: AdminTagFamily) => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const move = async (index: number, delta: number) => {
    const ids = families.map((f) => f.id);
    const [moved] = ids.splice(index, 1);
    if (!moved) return;
    ids.splice(index + delta, 0, moved);
    try {
      await api.put("/admin/tag-families/order", { ids });
      await queryClient.invalidateQueries({ queryKey: adminTagFamiliesQuery.queryKey });
    } catch (error) {
      toast(errorMessage(error), { tone: "danger" });
    }
  };
  if (families.length === 0) {
    return (
      <p className="m-0 text-ink-muted">Aucune famille : tous les tags sont dans « Autres ».</p>
    );
  }
  return (
    <TableScroll label="Familles de tags">
      <table aria-label="Familles de tags" className="fm-table max-w-3xl">
        <thead>
          <tr>
            <th scope="col">Français</th>
            <th scope="col">Anglais</th>
            <th scope="col">Tags</th>
            <th scope="col">
              <span className="fm-sr">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {families.map((family, index) => (
            <tr key={family.id}>
              <th scope="row" className="font-semibold">
                {family.fr}
              </th>
              <td>{family.en ?? <Badge tone="warning">À traduire</Badge>}</td>
              <td className="font-mono">{family.tagCount}</td>
              <td>
                <div className="flex justify-end gap-1">
                  <IconButton
                    icon="arrow-up"
                    label={`Monter ${family.fr}`}
                    disabled={index === 0}
                    onClick={() => void move(index, -1)}
                  />
                  <IconButton
                    icon="arrow-down"
                    label={`Descendre ${family.fr}`}
                    disabled={index === families.length - 1}
                    onClick={() => void move(index, 1)}
                  />
                  <IconButton
                    icon="pencil"
                    label={`Renommer ou traduire ${family.fr}`}
                    onClick={() => {
                      onEdit(family);
                    }}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableScroll>
  );
}

export function TagsPage() {
  const tags = useQuery(adminTagsQuery);
  const families = useQuery(adminTagFamiliesQuery);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [dialog, setDialog] = useState<Dialog>(null);
  const close = () => {
    setDialog(null);
  };
  const editing = dialog?.kind === "edit" ? dialog : null;
  const editingFamily = dialog?.kind === "edit-family" ? dialog : null;

  const saveFamily = async (family: AdminTagFamily | null, value: TranslatedName) => {
    await (family
      ? api.patch(`/admin/tag-families/${family.id}`, value, adminTagFamilySchema)
      : api.post("/admin/tag-families", value, adminTagFamilySchema));
    toast(family ? `Famille « ${value.fr} » enregistrée` : `Famille « ${value.fr} » créée`, {
      tone: "success",
    });
    await queryClient.invalidateQueries({ queryKey: adminTagFamiliesQuery.queryKey });
  };
  const setFamily = async (tag: AdminTag, familyId: string) => {
    try {
      await api.patch(
        `/admin/tags/${tag.id}`,
        { fr: tag.fr, en: tag.en, familyId: familyId || null },
        adminTagSchema
      );
      await queryClient.invalidateQueries({ queryKey: ["admin"] });
    } catch (error) {
      toast(errorMessage(error), { tone: "danger" });
    }
  };

  const save = async (tag: AdminTag | null, value: TranslatedName) => {
    await (tag
      ? api.patch(`/admin/tags/${tag.id}`, value, adminTagSchema)
      : api.post("/admin/tags", value, adminTagSchema));
    toast(tag ? `Tag « ${value.fr} » enregistré` : `Tag « ${value.fr} » créé`, {
      tone: "success",
    });
    await queryClient.invalidateQueries({ queryKey: adminTagsQuery.queryKey });
  };

  return (
    <>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-[1_1_360px] flex-col gap-1">
          <h1 className="m-0 font-display text-2xl font-bold">Tags globaux</h1>
          <p className="m-0 text-ink-muted">
            Une liste courte, commune à tous les espaces et traduite. Les tags propres à chaque
            espace sont gérés par ses modérateurs, pas ici.
          </p>
        </div>
        <Button
          icon="plus"
          onClick={() => {
            setDialog({ kind: "edit", tag: null });
          }}
        >
          Nouveau tag global
        </Button>
      </div>
      {tags.isPending ? (
        <Skeleton label="Chargement des tags" />
      ) : tags.isError ? (
        <FormAlert message={errorMessage(tags.error)} />
      ) : (
        <TableScroll label="Tags globaux">
          <table aria-label="Tags globaux" className="fm-table max-w-3xl">
            <thead>
              <tr>
                <th scope="col">Français</th>
                <th scope="col">Anglais</th>
                <th scope="col">Recettes</th>
                <th scope="col">Famille</th>
                <th scope="col">
                  <span className="fm-sr">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {tags.data.map((tag) => (
                <tr key={tag.id}>
                  <th scope="row" className="font-semibold">
                    {tag.fr}
                  </th>
                  <td>{tag.en ?? <Badge tone="warning">À traduire</Badge>}</td>
                  <td className="font-mono">{tag.recipeCount}</td>
                  <td>
                    <select
                      className="fm-input"
                      aria-label={`Famille de ${tag.fr}`}
                      value={tag.familyId ?? ""}
                      onChange={(event) => void setFamily(tag, event.target.value)}
                    >
                      <option value="">Autres</option>
                      {(families.data ?? []).map((family) => (
                        <option key={family.id} value={family.id}>
                          {family.fr}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <IconButton
                        icon="pencil"
                        label={`Renommer ou traduire ${tag.fr}`}
                        onClick={() => {
                          setDialog({ kind: "edit", tag });
                        }}
                      />
                      <IconButton
                        icon="git-branch"
                        label={`Fusionner ${tag.fr} dans un autre tag`}
                        onClick={() => {
                          setDialog({ kind: "merge", tag });
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      )}
      <p className="m-0 max-w-3xl text-sm text-ink-muted">
        Supprimer un tag global le retire de toutes les recettes. Fusionner déplace ses recettes
        vers l&apos;autre tag ; l&apos;action est enregistrée dans le journal d&apos;audit.
      </p>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-[1_1_360px] flex-col gap-1">
          <h2 className="m-0 font-display text-xl font-bold">Familles de tags</h2>
          <p className="m-0 text-ink-muted">
            Elles rangent les tags dans les filtres de tous les espaces : on y choisit Hiver ou
            Automne dans une même famille, et un tag de chaque famille se cumule.
          </p>
        </div>
        <Button
          icon="plus"
          onClick={() => {
            setDialog({ kind: "edit-family", family: null });
          }}
        >
          Nouvelle famille
        </Button>
      </div>
      {families.isPending ? (
        <Skeleton label="Chargement des familles" />
      ) : families.isError ? (
        <FormAlert message={errorMessage(families.error)} />
      ) : (
        <FamiliesTable
          families={families.data}
          onEdit={(family) => {
            setDialog({ kind: "edit-family", family });
          }}
        />
      )}
      <TranslatedNameSheet
        open={editing !== null}
        title={editing?.tag ? `Modifier « ${editing.tag.fr} »` : "Nouveau tag global"}
        submitLabel={editing?.tag ? "Enregistrer" : "Créer"}
        initial={editing?.tag ? { fr: editing.tag.fr, en: editing.tag.en } : undefined}
        maxLength={TAG_NAME_MAX}
        extra={
          editing?.tag ? (
            <Button
              type="button"
              variant="ghost"
              icon="trash"
              onClick={() => {
                if (editing.tag) setDialog({ kind: "delete", tag: editing.tag });
              }}
            >
              Supprimer le tag
            </Button>
          ) : null
        }
        onClose={close}
        onSubmit={(value) => save(editing?.tag ?? null, value)}
      />
      <MergeTagSheet
        tag={dialog?.kind === "merge" ? dialog.tag : null}
        tags={tags.data ?? []}
        onClose={close}
      />
      <DeleteTagSheet tag={dialog?.kind === "delete" ? dialog.tag : null} onClose={close} />
      <TranslatedNameSheet
        open={editingFamily !== null}
        title={
          editingFamily?.family ? `Modifier « ${editingFamily.family.fr} »` : "Nouvelle famille"
        }
        submitLabel={editingFamily?.family ? "Enregistrer" : "Créer"}
        initial={
          editingFamily?.family
            ? { fr: editingFamily.family.fr, en: editingFamily.family.en }
            : undefined
        }
        maxLength={TAG_FAMILY_NAME_MAX}
        extra={
          editingFamily?.family ? (
            <Button
              type="button"
              variant="ghost"
              icon="trash"
              onClick={() => {
                if (editingFamily.family) {
                  setDialog({ kind: "delete-family", family: editingFamily.family });
                }
              }}
            >
              Supprimer la famille
            </Button>
          ) : null
        }
        onClose={close}
        onSubmit={(value) => saveFamily(editingFamily?.family ?? null, value)}
      />
      <DeleteFamilySheet
        family={dialog?.kind === "delete-family" ? dialog.family : null}
        onClose={close}
      />
    </>
  );
}
