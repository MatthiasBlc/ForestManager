// F-FILTRES [D216] : bouton "Filtres", filtres actifs retirables, feuille de
// filtres (ordre de la liste [D217], tags par famille, Bases, espace d'origine).
// Liste des recettes et "Depuis mes recettes".
import { RECIPE_SORTS, type RecipeSort, type SpaceSummary, type TagCatalog } from "@fm/shared";

import { Button } from "../../ui/button.tsx";
import { Chip, Switch } from "../../ui/controls.tsx";
import { Icon } from "../../ui/icon.tsx";
import { SheetFooter } from "../../ui/sheet.tsx";
import { TagSheet } from "./components/tag-sheet.tsx";
import { RECIPE_SORT_LABELS } from "./sort.ts";
import { homeLabel } from "./tag-groups.ts";

/** Filtre actif affiche sous la recherche. */
export interface ActiveFilter {
  key: string;
  label: string;
  onRemove: () => void;
}

/** Bouton "Filtres" avec le nombre de filtres actifs. */
export function FiltersButton({ count, onClick }: { count: number; onClick: () => void }) {
  // Nom lu "Filtres (2)" : les parentheses ne sont que pour les lecteurs d'ecran,
  // le texte visible reste dans le nom (axe label-content-name-mismatch).
  return (
    <Button icon="filters" onClick={onClick}>
      Filtres
      {count > 0 ? (
        <>
          {" "}
          <span className="fm-filters-count">
            <span className="fm-sr">(</span>
            {count}
            <span className="fm-sr">)</span>
          </span>
        </>
      ) : null}
    </Button>
  );
}

/** Seulement les filtres actifs, retirables d'un toucher. */
export function ActiveFilters({ filters }: { filters: readonly ActiveFilter[] }) {
  if (filters.length === 0) return null;
  return (
    <div className="fm-chip-row" role="group" aria-label="Filtres actifs">
      {filters.map((filter) => (
        <button
          key={filter.key}
          type="button"
          className="fm-chip"
          aria-pressed="true"
          // Le nom commence par le texte visible (axe label-content-name-mismatch).
          aria-label={`${filter.label}, retirer le filtre`}
          onClick={filter.onRemove}
        >
          {filter.label}
          <Icon name="x" size={16} />
        </button>
      ))}
    </div>
  );
}

export function FiltersSheet({
  open,
  onClose,
  catalog,
  spaceName,
  counts,
  include,
  tagIds,
  onTagIds,
  baseOnly,
  onBaseOnly,
  homeChoices = [],
  homeSpaceId = null,
  onHomeSpaceId,
  sort,
  onSort,
  total,
  onClear,
}: {
  open: boolean;
  onClose: () => void;
  catalog: TagCatalog | undefined;
  spaceName: string;
  /** Nombre de recettes par tag (liste d'un espace) ; sans nombre dans "Mes recettes". */
  counts: boolean;
  include?: (tag: TagCatalog["tags"][number]) => boolean;
  tagIds: readonly string[];
  onTagIds: (ids: string[]) => void;
  baseOnly: boolean;
  onBaseOnly: (on: boolean) => void;
  /** "Mes recettes" : espaces d'origine possibles. */
  homeChoices?: readonly SpaceSummary[];
  homeSpaceId?: string | null;
  onHomeSpaceId?: (id: string | null) => void;
  /** Ordre de la liste [D217] ; sans lui, pas de section "Trier par". */
  sort?: RecipeSort;
  onSort?: (sort: RecipeSort) => void;
  /** Nombre de recettes filtrees, si connu. */
  total: number | undefined;
  onClear: () => void;
}) {
  return (
    <TagSheet
      open={open}
      onClose={onClose}
      title="Filtres"
      catalog={catalog}
      spaceName={spaceName}
      include={include}
      counts={counts}
      selected={tagIds}
      onChange={onTagIds}
      header={
        sort && onSort ? (
          <div className="flex flex-col gap-2" role="group" aria-label="Trier par">
            <span className="fm-label">Trier par</span>
            <div className="flex flex-wrap gap-2">
              {RECIPE_SORTS.map((choice) => (
                <Chip
                  key={choice}
                  selected={sort === choice}
                  onToggle={() => {
                    onSort(choice);
                  }}
                >
                  {RECIPE_SORT_LABELS[choice]}
                </Chip>
              ))}
            </div>
          </div>
        ) : null
      }
      footer={
        <SheetFooter>
          <Button onClick={onClear}>Effacer</Button>
          <Button variant="primary" onClick={onClose}>
            {total === undefined
              ? "Voir les recettes"
              : `Voir ${String(total)} ${total > 1 ? "recettes" : "recette"}`}
          </Button>
        </SheetFooter>
      }
    >
      <Switch label="Bases seulement (sauces, pâtes…)" checked={baseOnly} onChange={onBaseOnly} />
      {homeChoices.length > 1 && onHomeSpaceId ? (
        <div className="flex flex-col gap-2" role="group" aria-label="Espace d'origine">
          <span className="fm-label">Espace d'origine</span>
          <div className="flex flex-wrap gap-2">
            <Chip
              selected={homeSpaceId === null}
              onToggle={() => {
                onHomeSpaceId(null);
              }}
            >
              Tous les espaces
            </Chip>
            {homeChoices.map((choice) => (
              <Chip
                key={choice.id}
                selected={homeSpaceId === choice.id}
                onToggle={(on) => {
                  onHomeSpaceId(on ? choice.id : null);
                }}
              >
                {homeLabel(choice)}
              </Chip>
            ))}
          </div>
        </div>
      ) : null}
    </TagSheet>
  );
}
