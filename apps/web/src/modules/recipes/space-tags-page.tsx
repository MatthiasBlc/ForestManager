// E-TAGS-ESPACE [D216] : Reglages de l'espace > Tags, pour les moderateurs.
// Familles de l'espace dans leur ordre (creer, renommer, monter, descendre,
// supprimer), puis "Autres" ; tags de l'espace avec leur nombre de recettes
// (renommer, changer de famille, fusionner, supprimer). Les tags et familles
// globaux se reglent dans l'admin.
import { TAG_FAMILY_NAME_MAX, TAG_NAME_MAX, type CatalogTag, type TagFamily } from "@fm/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { useNavigate, useParams } from "react-router";

import { FormAlert } from "../../core/access/auth-layout.tsx";
import { spaceQuery } from "../../core/session/queries.ts";
import { PageChrome } from "../../core/shell/page-chrome.tsx";
import { errorMessage } from "../../i18n/index.ts";
import { api } from "../../lib/api.ts";
import { plural } from "../../lib/plural.ts";
import { TopBar } from "../../patterns/top-bar.tsx";
import { ActionMenu } from "../../ui/action-menu.tsx";
import { Button, IconButton } from "../../ui/button.tsx";
import { Skeleton } from "../../ui/display.tsx";
import { Field } from "../../ui/field.tsx";
import { Sheet, SheetFooter } from "../../ui/sheet.tsx";
import { useToast } from "../../ui/use-toast.ts";
import { recipesKey, tagCatalogQuery } from "./queries.ts";

type Dialog =
  | { kind: "new-family" }
  | { kind: "rename-family"; family: TagFamily }
  | { kind: "delete-family"; family: TagFamily }
  | { kind: "rename-tag"; tag: CatalogTag }
  | { kind: "family-of"; tag: CatalogTag }
  | { kind: "merge-tag"; tag: CatalogTag }
  | { kind: "delete-tag"; tag: CatalogTag }
  | null;

/** Nom saisi dans une feuille (famille ou tag). */
function NameSheet({
  open,
  title,
  initial,
  maxLength,
  submitLabel,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  initial: string;
  maxLength: number;
  submitLabel: string;
  onClose: () => void;
  onSubmit: (name: string) => Promise<unknown>;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {open ? (
        <NameForm
          initial={initial}
          maxLength={maxLength}
          submitLabel={submitLabel}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      ) : null}
    </Sheet>
  );
}

function NameForm({
  initial,
  maxLength,
  submitLabel,
  onClose,
  onSubmit,
}: {
  initial: string;
  maxLength: number;
  submitLabel: string;
  onClose: () => void;
  onSubmit: (name: string) => Promise<unknown>;
}) {
  const [name, setName] = useState(initial);
  const save = useMutation({ mutationFn: () => onSubmit(name.trim()), onSuccess: onClose });
  return (
    <form
      className="fm-stack"
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim()) save.mutate();
      }}
    >
      <FormAlert message={save.isError ? errorMessage(save.error) : undefined} />
      <Field
        label="Nom"
        value={name}
        maxLength={maxLength}
        autoComplete="off"
        onChange={(event) => {
          setName(event.target.value);
        }}
      />
      <SheetFooter>
        <Button onClick={onClose}>Annuler</Button>
        <Button type="submit" variant="primary" disabled={!name.trim() || save.isPending}>
          {submitLabel}
        </Button>
      </SheetFooter>
    </form>
  );
}

/** Choix dans une liste (famille d'un tag, tag cible d'une fusion). */
function SelectSheet({
  open,
  title,
  label,
  options,
  initial,
  emptyLabel,
  submitLabel,
  danger,
  hint,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  label: string;
  options: readonly { id: string; name: string }[];
  initial: string;
  emptyLabel: string;
  submitLabel: string;
  danger?: boolean;
  hint?: (value: string) => string | null;
  onClose: () => void;
  onSubmit: (value: string) => Promise<unknown>;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {open ? (
        <SelectForm
          label={label}
          options={options}
          initial={initial}
          emptyLabel={emptyLabel}
          submitLabel={submitLabel}
          danger={danger}
          hint={hint}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      ) : null}
    </Sheet>
  );
}

function SelectForm({
  label,
  options,
  initial,
  emptyLabel,
  submitLabel,
  danger,
  hint,
  onClose,
  onSubmit,
}: {
  label: string;
  options: readonly { id: string; name: string }[];
  initial: string;
  emptyLabel: string;
  submitLabel: string;
  danger?: boolean;
  hint?: (value: string) => string | null;
  onClose: () => void;
  onSubmit: (value: string) => Promise<unknown>;
}) {
  const selectId = useId();
  const [value, setValue] = useState(initial);
  const save = useMutation({ mutationFn: () => onSubmit(value), onSuccess: onClose });
  const note = hint?.(value);
  return (
    <div className="fm-stack">
      <FormAlert message={save.isError ? errorMessage(save.error) : undefined} />
      <div className="fm-field">
        <label htmlFor={selectId} className="fm-label">
          {label}
        </label>
        <select
          id={selectId}
          className="fm-input"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
          }}
        >
          <option value="">{emptyLabel}</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </div>
      {note ? <p className="m-0 text-ink-muted">{note}</p> : null}
      <SheetFooter>
        <Button onClick={onClose}>Annuler</Button>
        <Button
          variant={danger ? "danger" : "primary"}
          disabled={save.isPending || (danger === true && !value)}
          onClick={() => {
            save.mutate();
          }}
        >
          {submitLabel}
        </Button>
      </SheetFooter>
    </div>
  );
}

function ConfirmSheet({
  open,
  title,
  text,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  text: string;
  onClose: () => void;
  onConfirm: () => Promise<unknown>;
}) {
  const remove = useMutation({ mutationFn: onConfirm, onSuccess: onClose });
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="fm-stack">
        <FormAlert message={remove.isError ? errorMessage(remove.error) : undefined} />
        <p className="m-0 text-ink-muted">{text}</p>
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

export function SpaceTagsPage() {
  const { spaceId = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const space = useQuery(spaceQuery(spaceId));
  const catalog = useQuery(tagCatalogQuery(spaceId));
  const [dialog, setDialog] = useState<Dialog>(null);
  const close = () => {
    setDialog(null);
  };
  const base = `/spaces/${spaceId}/recipes`;
  const spaceName = space.data?.name ?? "";
  // Les nombres et l'ordre changent partout : liste, filtres, editeur.
  const refresh = () => queryClient.invalidateQueries({ queryKey: recipesKey(spaceId) });
  const done = async (message: string) => {
    toast(message, { tone: "success" });
    await refresh();
  };

  const families = (catalog.data?.families ?? []).filter((f) => f.scope === "SPACE");
  const tags = (catalog.data?.tags ?? []).filter((t) => t.scope === "SPACE");
  const groups: { family: TagFamily | null; tags: CatalogTag[] }[] = [
    ...families.map((family) => ({
      family,
      tags: tags.filter((tag) => tag.familyId === family.id),
    })),
    {
      family: null,
      tags: tags.filter((tag) => !families.some((family) => family.id === tag.familyId)),
    },
  ];

  const move = async (family: TagFamily, delta: number) => {
    const ids = families.map((f) => f.id);
    const from = ids.indexOf(family.id);
    const to = from + delta;
    if (to < 0 || to >= ids.length) return;
    ids.splice(from, 1);
    ids.splice(to, 0, family.id);
    try {
      await api.put(`${base}/tag-families/order`, { ids });
      await refresh();
    } catch (error) {
      toast(errorMessage(error), { tone: "danger" });
    }
  };

  // Ordre d'un tag dans sa famille, comme celui des familles.
  const moveTag = async (family: TagFamily, list: CatalogTag[], tag: CatalogTag, delta: number) => {
    const ids = list.map((t) => t.id);
    const from = ids.indexOf(tag.id);
    const to = from + delta;
    if (to < 0 || to >= ids.length) return;
    ids.splice(from, 1);
    ids.splice(to, 0, tag.id);
    try {
      await api.put(`${base}/tag-families/${family.id}/tags/order`, { ids });
      await refresh();
    } catch (error) {
      toast(errorMessage(error), { tone: "danger" });
    }
  };

  let content;
  if (catalog.isError) {
    content = <FormAlert message={errorMessage(catalog.error)} />;
  } else if (!catalog.data) {
    content = <Skeleton kind="row" count={4} label="Chargement des tags…" />;
  } else {
    content = groups.map(({ family, tags: list }, index) => {
      const name = family?.name ?? "Autres";
      const headingId = `space-tags-${family?.id ?? "others"}`;
      return (
        <section
          key={family?.id ?? "others"}
          aria-labelledby={headingId}
          className="fm-stack border-t border-line pt-3"
        >
          <div className="flex items-center gap-2">
            <h2 id={headingId} className="m-0 flex-1 font-display text-lg font-bold">
              {name}
            </h2>
            {family ? (
              <ActionMenu
                label={`Actions de la famille ${family.name}`}
                trigger={<IconButton icon="more" label={`Actions de la famille ${family.name}`} />}
                items={[
                  { id: "rename", label: "Renommer", icon: "pencil" },
                  { id: "up", label: "Monter", icon: "arrow-up", disabled: index === 0 },
                  {
                    id: "down",
                    label: "Descendre",
                    icon: "arrow-down",
                    disabled: index === families.length - 1,
                  },
                  "-",
                  { id: "delete", label: "Supprimer", icon: "trash", danger: true },
                ]}
                onSelect={(id) => {
                  if (id === "rename") setDialog({ kind: "rename-family", family });
                  else if (id === "delete") setDialog({ kind: "delete-family", family });
                  else void move(family, id === "up" ? -1 : 1);
                }}
              />
            ) : null}
          </div>
          {list.length === 0 ? (
            <p className="m-0 text-sm text-ink-muted">
              {family ? "Aucun tag" : "Aucun tag sans famille"}
            </p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {list.map((tag, tagIndex) => (
                <li key={tag.id} className="flex items-center gap-2">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <b className="text-[15px]">{tag.name}</b>
                    <small className="text-ink-muted">
                      {plural(tag.recipeCount, "recette", "recettes")}
                    </small>
                  </span>
                  <ActionMenu
                    label={`Actions du tag ${tag.name}`}
                    trigger={<IconButton icon="more" label={`Actions du tag ${tag.name}`} />}
                    items={[
                      { id: "rename", label: "Renommer", icon: "pencil" },
                      ...(family
                        ? [
                            {
                              id: "up",
                              label: "Monter",
                              icon: "arrow-up" as const,
                              disabled: tagIndex === 0,
                            },
                            {
                              id: "down",
                              label: "Descendre",
                              icon: "arrow-down" as const,
                              disabled: tagIndex === list.length - 1,
                            },
                          ]
                        : []),
                      { id: "family", label: "Changer de famille", icon: "tag" },
                      {
                        id: "merge",
                        label: "Fusionner",
                        icon: "git-branch",
                        disabled: tags.length < 2,
                      },
                      "-",
                      { id: "delete", label: "Supprimer", icon: "trash", danger: true },
                    ]}
                    onSelect={(id) => {
                      if (family && (id === "up" || id === "down")) {
                        void moveTag(family, list, tag, id === "up" ? -1 : 1);
                      } else if (id === "rename") setDialog({ kind: "rename-tag", tag });
                      else if (id === "family") setDialog({ kind: "family-of", tag });
                      else if (id === "merge") setDialog({ kind: "merge-tag", tag });
                      else setDialog({ kind: "delete-tag", tag });
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      );
    });
  }

  const familyDialog = dialog && "family" in dialog ? dialog.family : null;
  const tagDialog = dialog && "tag" in dialog ? dialog.tag : null;

  return (
    <>
      <PageChrome
        top={
          <TopBar
            title="Tags"
            onBack={() => {
              void navigate(`/s/${spaceId}/settings`);
            }}
          />
        }
      />
      <div className="fm-stack mx-auto w-full max-w-2xl p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="m-0 flex-1 font-display text-2xl font-bold">Tags de {spaceName}</h1>
          <Button
            icon="plus"
            onClick={() => {
              setDialog({ kind: "new-family" });
            }}
          >
            Nouvelle famille
          </Button>
        </div>
        <p className="m-0 text-sm text-ink-muted">
          Les familles rangent les tags dans les filtres : on choisit Hiver ou Automne dans une même
          famille. Les tags communs à tous les espaces se règlent ailleurs.
        </p>
        {content}
      </div>

      <NameSheet
        open={dialog?.kind === "new-family"}
        title="Nouvelle famille"
        initial=""
        maxLength={TAG_FAMILY_NAME_MAX}
        submitLabel="Créer"
        onClose={close}
        onSubmit={async (name) => {
          await api.post(`${base}/tag-families`, { name });
          await done(`Famille « ${name} » créée`);
        }}
      />
      <NameSheet
        open={dialog?.kind === "rename-family"}
        title={`Renommer « ${familyDialog?.name ?? ""} »`}
        initial={familyDialog?.name ?? ""}
        maxLength={TAG_FAMILY_NAME_MAX}
        submitLabel="Enregistrer"
        onClose={close}
        onSubmit={async (name) => {
          await api.patch(`${base}/tag-families/${familyDialog?.id ?? ""}`, { name });
          await done(`Famille renommée en « ${name} »`);
        }}
      />
      <ConfirmSheet
        open={dialog?.kind === "delete-family"}
        title={`Supprimer « ${familyDialog?.name ?? ""} » ?`}
        text="La famille disparaît ; ses tags passent dans « Autres », sans rien perdre."
        onClose={close}
        onConfirm={async () => {
          await api.delete(`${base}/tag-families/${familyDialog?.id ?? ""}`);
          await done(`Famille « ${familyDialog?.name ?? ""} » supprimée`);
        }}
      />
      <NameSheet
        open={dialog?.kind === "rename-tag"}
        title={`Renommer « ${tagDialog?.name ?? ""} »`}
        initial={tagDialog?.name ?? ""}
        maxLength={TAG_NAME_MAX}
        submitLabel="Enregistrer"
        onClose={close}
        onSubmit={async (name) => {
          await api.patch(`${base}/tags/${tagDialog?.id ?? ""}`, { name });
          await done(`Tag renommé en « ${name} »`);
        }}
      />
      <SelectSheet
        open={dialog?.kind === "family-of"}
        title={`Famille de « ${tagDialog?.name ?? ""} »`}
        label="Famille"
        options={families}
        initial={tagDialog?.familyId ?? ""}
        emptyLabel="Autres (sans famille)"
        submitLabel="Enregistrer"
        onClose={close}
        onSubmit={async (familyId) => {
          await api.patch(`${base}/tags/${tagDialog?.id ?? ""}`, { familyId: familyId || null });
          await done(`« ${tagDialog?.name ?? ""} » rangé`);
        }}
      />
      <SelectSheet
        open={dialog?.kind === "merge-tag"}
        title={`Fusionner « ${tagDialog?.name ?? ""} »`}
        label="Fusionner dans"
        options={tags.filter((tag) => tag.id !== tagDialog?.id)}
        initial=""
        emptyLabel="Choisir un tag"
        submitLabel="Fusionner"
        danger
        hint={(intoId) => {
          const into = tags.find((tag) => tag.id === intoId);
          return into && tagDialog
            ? `Ses ${plural(tagDialog.recipeCount, "recette", "recettes")} passeront à « ${into.name} » et « ${tagDialog.name} » disparaîtra.`
            : null;
        }}
        onClose={close}
        onSubmit={async (intoTagId) => {
          await api.post(`${base}/tags/${tagDialog?.id ?? ""}/merge`, { intoTagId });
          await done(`« ${tagDialog?.name ?? ""} » fusionné`);
        }}
      />
      <ConfirmSheet
        open={dialog?.kind === "delete-tag"}
        title={`Supprimer « ${tagDialog?.name ?? ""} » ?`}
        text={
          tagDialog && tagDialog.recipeCount > 0
            ? `Il sera retiré de ses ${plural(tagDialog.recipeCount, "recette", "recettes")} dans ${spaceName}.`
            : "Aucune recette ne l'utilise."
        }
        onClose={close}
        onConfirm={async () => {
          await api.delete(`${base}/tags/${tagDialog?.id ?? ""}`);
          await done(`Tag « ${tagDialog?.name ?? ""} » supprimé`);
        }}
      />
    </>
  );
}
