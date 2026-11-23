// F-DEPUIS-PLANNING [D228] : les ingredients des repas d'une periode, additionnes et
// ranges par section, tous coches sauf le facultatif ; on decoche ce qu'on a deja,
// puis "Ajouter N articles" (le serveur recalcule et fusionne). Ce qui est deja dans
// la liste est signale, comme les repas deja ajoutes, sans recette ou incomplets.
// Ouverte depuis la liste et depuis la barre du planning, meme feuille.
import {
  applyPlanResultSchema,
  planPreviewBodySchema,
  planPreviewSchema,
  type PlanPreview,
  type PlanPreviewLine,
  type ShoppingSection,
  type Unit,
} from "@fm/shared";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { FormAlert } from "../../core/access/auth-layout.tsx";
import { errorMessage } from "../../i18n/index.ts";
import { api } from "../../lib/api.ts";
import { useWriteGuard } from "../../pwa/use-write-guard.ts";
import { Button } from "../../ui/button.tsx";
import { EmptyState, Skeleton } from "../../ui/display.tsx";
import { Field } from "../../ui/field.tsx";
import { Icon } from "../../ui/icon.tsx";
import { Sheet, SheetFooter } from "../../ui/sheet.tsx";
import { useToast } from "../../ui/use-toast.ts";
import { whenLabel } from "../meal-plan/dates.ts";
import { unitsQuery } from "../recipes/queries.ts";
import { formatParts, itemName } from "./entry.ts";
import type { Period } from "./period.ts";
import { listQuery, shoppingKey } from "./queries.ts";

const plural = (n: number, one: string, many: string) => `${String(n)} ${n > 1 ? many : one}`;

/** "2 articles ajoutés et 1 complété" [R9]. */
function addedMessage(added: number, updated: number): string {
  if (added === 0 && updated === 0) return "Rien de nouveau dans la liste";
  if (added === 0) return plural(updated, "article complété", "articles complétés");
  const first = plural(added, "article ajouté", "articles ajoutés");
  return updated > 0 ? `${first} et ${plural(updated, "complété", "complétés")}` : first;
}

/** Repas cites a part : sans recette, deja ajoutes, sous-recettes invisibles. */
function notes(preview: PlanPreview): string[] {
  const out: string[] = [];
  const { skippedMeals, addedMeals, missingSubRecipes } = preview;
  if (skippedMeals.length > 0) {
    const titles = skippedMeals.map((meal) => meal.title || "recette indisponible");
    out.push(
      `${plural(skippedMeals.length, "repas", "repas")} sans recette : ${titles.join(", ")}`
    );
  }
  for (const meal of addedMeals) {
    out.push(`${meal.title} (${whenLabel(meal.date, meal.mealTime)}) : déjà ajouté à la liste`);
  }
  for (const sub of missingSubRecipes) {
    out.push(`${sub.title} (dans ${sub.inRecipe}) : ingrédients manquants`);
  }
  return out;
}

function LineRow({
  line,
  units,
  checked,
  onChange,
}: {
  line: PlanPreviewLine;
  units: readonly Unit[];
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const name = itemName({ ingredient: line.ingredient, label: null });
  const amount = formatParts(line.parts, units);
  const recipes = [...new Set(line.sources.map((source) => source.recipeTitle))].join(", ");
  const detail = [
    line.inList ? `déjà ${formatParts(line.inList, units) || "là"} dans la liste` : recipes,
    line.optional ? "facultatif" : null,
    line.toCheck ? "quantité à vérifier" : null,
    line.parts.length === 0 ? "à goût" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <li>
      <label className="fm-pick">
        <input
          type="checkbox"
          aria-label={name}
          checked={checked}
          onChange={(event) => {
            onChange(event.target.checked);
          }}
        />
        <span className="fm-pick-text flex-1">
          <b>{name}</b>
          {detail ? <small>{detail}</small> : null}
        </span>
        {amount ? (
          <span className="fm-shop-qty">{line.inList ? `+ ${amount}` : amount}</span>
        ) : null}
      </label>
    </li>
  );
}

export function FromPlanSheet({
  spaceId,
  period,
  onClose,
}: {
  spaceId: string;
  /** Periode proposee a l'ouverture. */
  period: Period;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const guard = useWriteGuard();
  const [from, setFrom] = useState(period.from);
  const [to, setTo] = useState(period.to);
  // Coches changees a la main, par ingredient ; sinon coche sauf le facultatif.
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const valid = planPreviewBodySchema.safeParse({ from, to }).success;

  const units = useQuery(unitsQuery);
  const list = useQuery(listQuery(spaceId));
  // Sous le prefixe de la liste : relu quand un membre la change.
  const preview = useQuery({
    queryKey: [...shoppingKey(spaceId), "from-plan", from, to],
    queryFn: () =>
      api.post(`/spaces/${spaceId}/shopping/from-plan/preview`, { from, to }, planPreviewSchema),
    enabled: valid,
    placeholderData: keepPreviousData,
  });

  const lines = preview.data?.lines ?? [];
  const isPicked = (line: PlanPreviewLine) => picked[line.ingredient.id] ?? !line.optional;
  const ingredientIds = lines.filter(isPicked).map((line) => line.ingredient.id);
  const n = ingredientIds.length;

  const apply = useMutation({
    mutationFn: () =>
      api.post(
        `/spaces/${spaceId}/shopping/from-plan`,
        { from, to, ingredientIds },
        applyPlanResultSchema
      ),
    onSuccess: async ({ added, updated }) => {
      await queryClient.invalidateQueries({ queryKey: shoppingKey(spaceId) });
      toast(addedMessage(added, updated), { tone: "success" });
      onClose();
    },
  });

  let content;
  if (preview.isError && !preview.data) {
    content = <FormAlert message={errorMessage(preview.error)} />;
  } else if (!preview.data || !units.data || !list.data) {
    content = valid ? <Skeleton kind="row" count={4} label="Calcul des ingrédients…" /> : null;
  } else {
    const sections: (ShoppingSection | { id: null; name: string })[] = [
      ...list.data.sections,
      { id: null, name: "Autres" },
    ];
    const known = new Set(list.data.sections.map((section) => section.id));
    const sectionOf = (line: PlanPreviewLine) =>
      line.sectionId !== null && known.has(line.sectionId) ? line.sectionId : null;
    const info = notes(preview.data);
    content = (
      <>
        {info.length > 0 ? (
          <div className="fm-shop-note">
            <Icon name="info" size={18} />
            <ul className="m-0 list-none p-0">
              {info.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {lines.length === 0 ? (
          <EmptyState icon="shopping-basket" title="Rien à acheter sur cette période">
            Les repas de ces jours n'ont pas de recette, ou le planning est vide.
          </EmptyState>
        ) : (
          sections.map((section) => {
            const inSection = lines.filter((line) => sectionOf(line) === section.id);
            if (inSection.length === 0) return null;
            return (
              <fieldset key={section.id ?? "others"} className="fm-shop-preview-group">
                <legend>{section.name}</legend>
                <ul className="fm-pick-list">
                  {inSection.map((line) => (
                    <LineRow
                      key={line.ingredient.id}
                      line={line}
                      units={units.data}
                      checked={isPicked(line)}
                      onChange={(checked) => {
                        setPicked((current) => ({ ...current, [line.ingredient.id]: checked }));
                      }}
                    />
                  ))}
                </ul>
              </fieldset>
            );
          })
        )}
      </>
    );
  }

  return (
    <Sheet open onClose={onClose} title="Depuis le planning">
      <div className="fm-stack">
        <div className="grid grid-cols-2 gap-2">
          <Field
            label="Du"
            type="date"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
            }}
          />
          <Field
            label="Au"
            type="date"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
            }}
          />
        </div>
        <FormAlert
          message={
            !valid
              ? "La période va de 1 à 31 jours."
              : apply.isError
                ? errorMessage(apply.error)
                : undefined
          }
        />
        {content}
        <SheetFooter>
          <Button
            variant="primary"
            block
            disabled={n === 0 || !valid || apply.isPending || guard.disabled === true}
            onClick={() => {
              apply.mutate();
            }}
          >
            {n === 0 ? "Rien à ajouter" : `Ajouter ${plural(n, "article", "articles")}`}
          </Button>
        </SheetFooter>
      </div>
    </Sheet>
  );
}
