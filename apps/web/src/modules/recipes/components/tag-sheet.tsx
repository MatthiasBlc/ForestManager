// F-TAGS [D216] : un seul composant de choix de tags, en feuille : recherche,
// tags groupes par famille (ordre des familles, puis "Autres"), choix multiple
// (filtres, editeur) ou unique (planning), creation d'un tag d'espace.
import { normalizeName, type CatalogTag, type TagCatalog } from "@fm/shared";
import { useState, type ReactNode } from "react";

import { Button } from "../../../ui/button.tsx";
import { Icon } from "../../../ui/icon.tsx";
import { Sheet, SheetFooter } from "../../../ui/sheet.tsx";
import { familyLabel, groupTags } from "../tag-groups.ts";

export interface TagSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  catalog: TagCatalog | undefined;
  /** Nom de l'espace, a cote des familles d'espace et dans "Creer le tag". */
  spaceName: string;
  /** Tags proposes (par defaut tout le catalogue). */
  include?: (tag: CatalogTag) => boolean;
  selected: readonly string[];
  onChange: (ids: string[]) => void;
  /** multiple : toucher coche et decoche ; single : toucher choisit et ferme. */
  mode?: "multiple" | "single";
  /** Filtres : nombre de recettes par tag, tags sans recette masques (sauf choisis). */
  counts?: boolean;
  /** Creation d'un tag d'espace quand la recherche ne trouve pas ce nom. */
  create?: (name: string) => Promise<void>;
  /** Contenu sous les tags (Bases, espace d'origine). */
  children?: ReactNode;
  /** Pied de la feuille ; par defaut "OK" en choix multiple. */
  footer?: ReactNode;
}

export function TagSheet({
  open,
  onClose,
  title,
  catalog,
  spaceName,
  include,
  selected,
  onChange,
  mode = "multiple",
  counts = false,
  create,
  children,
  footer,
}: TagSheetProps) {
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const term = normalizeName(search);
  const offered = (catalog?.tags ?? []).filter(
    (tag) =>
      (include?.(tag) ?? true) &&
      (!counts || tag.recipeCount > 0 || selected.includes(tag.id)) &&
      (!term || normalizeName(tag.name).includes(term))
  );
  const groups = catalog ? groupTags(catalog, offered) : [];
  const name = search.trim();
  const canCreate =
    create !== undefined &&
    name !== "" &&
    !(catalog?.tags ?? []).some(
      (tag) => (include?.(tag) ?? true) && normalizeName(tag.name) === term
    );

  const toggle = (id: string) => {
    if (mode === "single") {
      onChange([id]);
      onClose();
      return;
    }
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  };
  const close = () => {
    setSearch("");
    onClose();
  };

  return (
    <Sheet open={open} onClose={close} title={title}>
      <div className="fm-stack">
        <input
          type="search"
          className="fm-input"
          aria-label="Chercher un tag"
          placeholder="Chercher un tag"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
          }}
        />
        {canCreate ? (
          <button
            type="button"
            className="fm-option w-full text-left"
            disabled={creating}
            onClick={() => {
              setCreating(true);
              void create(name)
                .then(() => {
                  setSearch("");
                })
                .finally(() => {
                  setCreating(false);
                });
            }}
          >
            <span className="fm-option-icon">
              <Icon name="plus" />
            </span>
            <span className="fm-option-text">
              <b>
                Créer le tag « {name} » dans {spaceName}
              </b>
              <small>Il va dans « Autres » ; un modérateur pourra le ranger.</small>
            </span>
          </button>
        ) : null}
        {groups.length === 0 && !canCreate ? (
          <p className="m-0 text-sm text-ink-muted">Aucun tag ne correspond.</p>
        ) : null}
        {groups.map((group) => {
          const label = familyLabel(group.family, spaceName);
          return (
            <div
              key={group.family?.id ?? "others"}
              className="flex flex-col gap-2"
              role="group"
              aria-label={label}
            >
              <span className="fm-label">{label}</span>
              <div className="flex flex-wrap gap-2">
                {group.tags.map((tag) => {
                  const on = selected.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      className="fm-chip"
                      aria-pressed={on}
                      onClick={() => {
                        toggle(tag.id);
                      }}
                    >
                      {on ? <Icon name="check" size={16} /> : null}
                      {tag.name}
                      {counts ? (
                        // Lu "Hiver, 42 recettes" ; seul le nombre se voit.
                        <>
                          <span className="fm-sr">
                            {`, ${String(tag.recipeCount)} ${tag.recipeCount > 1 ? "recettes" : "recette"}`}
                          </span>
                          <span className="fm-chip-count" aria-hidden="true">
                            {tag.recipeCount}
                          </span>
                        </>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        {children}
      </div>
      {footer ??
        (mode === "multiple" ? (
          <SheetFooter>
            <Button variant="primary" onClick={close}>
              OK
            </Button>
          </SheetFooter>
        ) : null)}
    </Sheet>
  );
}
