// F-AJOUT-BLOC et F-LIER-RECETTE : ajouter un bloc local ou lier une autre
// recette ; bases proposees d'abord, quantite dans l'unite de rendement de la
// recette liee [D24, D107].
import { formatQuantity, type RecipeSummary, type Unit } from "@fm/shared";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "../../../ui/button.tsx";
import { Field } from "../../../ui/field.tsx";
import { Icon } from "../../../ui/icon.tsx";
import { OptionList } from "../../../ui/option-list.tsx";
import { Sheet, SheetFooter } from "../../../ui/sheet.tsx";
import { parseQuantity, type DraftLinkedBlock } from "../draft.ts";
import { formatYield } from "../format.ts";
import { recipesQuery } from "../queries.ts";
import { useDebounced } from "../../../lib/use-debounced.ts";

export function AddBlockSheet({
  open,
  onClose,
  onLocal,
  onLink,
}: {
  open: boolean;
  onClose: () => void;
  onLocal: () => void;
  onLink: () => void;
}) {
  const choices = [
    {
      icon: "plus" as const,
      title: "Bloc local",
      text: "Ses propres ingrédients et étapes, par exemple « Assemblage ».",
      onClick: onLocal,
    },
    {
      icon: "link" as const,
      title: "Lier une recette",
      text: "Réutiliser une recette existante, comme une sauce. Si elle change, ce plat suit.",
      onClick: onLink,
    },
  ];
  return (
    <Sheet open={open} onClose={onClose} title="Ajouter un bloc">
      <div className="fm-stack">
        {choices.map((choice) => (
          <button key={choice.title} type="button" className="fm-option" onClick={choice.onClick}>
            <span className="fm-option-icon">
              <Icon name={choice.icon} />
            </span>
            <span className="fm-option-text">
              <b>{choice.title}</b>
              <small>{choice.text}</small>
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

/** Bases d'abord [D107], puis l'ordre de la recherche. */
function basesFirst(recipes: readonly RecipeSummary[]): RecipeSummary[] {
  return [...recipes.filter((r) => r.isBase), ...recipes.filter((r) => !r.isBase)];
}

export function LinkRecipeSheet({
  open,
  onClose,
  spaceId,
  currentRecipeId,
  units,
  onLink,
}: {
  open: boolean;
  onClose: () => void;
  spaceId: string;
  currentRecipeId?: string;
  units: readonly Unit[];
  onLink: (block: Omit<DraftLinkedBlock, "key">) => void;
}) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("");
  const q = useDebounced(search.trim());
  // Resultats precedents gardes pendant la recherche suivante (pas de liste vide a chaque touche).
  const list = useInfiniteQuery({
    ...recipesQuery(spaceId, { q }),
    enabled: open,
    placeholderData: keepPreviousData,
  });
  const results = basesFirst(list.data?.pages.flatMap((page) => page.data) ?? []);
  const selected = results.find((r) => r.id === selectedId);
  const unit = units.find((u) => u.id === selected?.yieldUnitId);
  const parsed = parseQuantity(quantity);
  const valid = parsed !== null && !Number.isNaN(parsed) && parsed > 0;

  return (
    <Sheet open={open} onClose={onClose} title="Lier une recette">
      <div className="fm-stack">
        <Field
          label="Rechercher dans tes espaces"
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
          }}
        />
        <small className="text-ink-muted">Bases d'abord</small>
        <OptionList
          label="Recettes trouvées"
          value={selectedId}
          onChange={setSelectedId}
          options={results.map((recipe) => {
            const current = recipe.id === currentRecipeId;
            return {
              value: recipe.id,
              label: recipe.title,
              hint: current
                ? "Impossible : c'est la recette en cours"
                : `rend ${formatYield(
                    recipe.yieldQuantity,
                    units.find((u) => u.id === recipe.yieldUnitId)
                  )}`,
              icon: "book-open" as const,
              badge: recipe.isBase ? "Base" : undefined,
              badgeTone: "second" as const,
              disabled: current,
            };
          })}
        />
        {selected ? (
          <>
            <div className="flex items-end gap-2">
              <Field
                label="Quantité utilisée"
                className="w-40"
                inputMode="decimal"
                value={quantity}
                onChange={(e) => {
                  setQuantity(e.target.value);
                }}
              />
              <span className="pb-3 text-sm text-ink-muted">
                {unit ? unit.abbreviation : "pers."} sur {formatQuantity(selected.yieldQuantity)}
              </span>
            </div>
            <small className="text-ink-muted">
              Les quantités suivent si tu changes les portions.
            </small>
          </>
        ) : null}
      </div>
      <SheetFooter>
        <Button
          variant="primary"
          icon="link"
          disabled={!selected || !valid}
          onClick={() => {
            if (!selected) return;
            onLink({
              kind: "RECIPE",
              recipeId: selected.id,
              title: selected.title,
              quantity: quantity.trim(),
              unitId: selected.yieldUnitId,
              yieldQuantity: selected.yieldQuantity,
            });
            setSearch("");
            setSelectedId(null);
            setQuantity("");
          }}
        >
          {selected ? `Lier ${selected.title}` : "Lier la recette"}
        </Button>
      </SheetFooter>
    </Sheet>
  );
}
