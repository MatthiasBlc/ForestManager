// E-MODE-CUISINE (F-REC-12) : une etape a la fois en grand, ingredients de l'etape,
// ecran maintenu allume (D35), feuille des ingredients a cocher (F-INGREDIENTS).
// Les portions viennent du detail (`?servings=`). Rien n'est enregistre.
import type { Recipe, Unit } from "@fm/shared";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";

import { PageChrome } from "../../core/shell/page-chrome.tsx";
import { useWakeLock } from "../../lib/wake-lock.ts";
import { Button, IconButton } from "../../ui/button.tsx";
import { Badge, EmptyState, Skeleton } from "../../ui/display.tsx";
import { Icon } from "../../ui/icon.tsx";
import { Sheet } from "../../ui/sheet.tsx";
import { IngredientRow } from "./components/ingredient-row.tsx";
import { cookIngredientGroups, cookSteps, type CookLine } from "./cook.ts";
import { formatYield } from "./format.ts";
import { recipeQuery, unitsQuery } from "./queries.ts";
import { RecipeNotFound } from "./recipe-page.tsx";

const LABEL = "text-xs font-semibold tracking-[.04em] text-ink-muted uppercase";

function CookView({
  spaceId,
  recipe,
  units,
  servings,
}: {
  spaceId: string;
  recipe: Recipe;
  units: readonly Unit[];
  servings: number;
}) {
  const navigate = useNavigate();
  const awake = useWakeLock();
  const scale = servings / recipe.yieldQuantity;
  const portions = formatYield(
    servings,
    units.find((u) => u.id === recipe.yieldUnitId)
  );
  const steps = useMemo(() => cookSteps(recipe, units, scale), [recipe, units, scale]);
  const groups = useMemo(() => cookIngredientGroups(recipe, units, scale), [recipe, units, scale]);
  const [index, setIndex] = useState(0);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [sheet, setSheet] = useState(false);
  const leave = () => {
    void navigate(`/s/${spaceId}/recipes/${recipe.id}`);
  };
  const row = (line: CookLine) => (
    <IngredientRow
      key={line.key}
      amount={line.amount}
      name={line.name}
      note={line.note}
      checked={checked[line.key] ?? false}
      onCheckedChange={(value) => {
        setChecked((current) => ({ ...current, [line.key]: value }));
      }}
    />
  );

  const step = steps[index];
  const last = index === steps.length - 1;
  const top = (
    <header className="fm-page-top bg-bg">
      <div className="flex items-center gap-2 py-2 pr-2 pl-4">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className={LABEL}>
            {steps.length > 0 ? `Étape ${index + 1} sur ${steps.length}` : "Mode cuisine"}
          </span>
          <span className="truncate text-[15px] leading-5 font-semibold">{recipe.title}</span>
        </div>
        <IconButton icon="x" label="Quitter le mode cuisine" onClick={leave} />
      </div>
      {steps.length > 0 ? (
        <div className="mx-4 h-1 rounded-full bg-line" aria-hidden="true">
          <div
            className="h-full rounded-full bg-accent"
            style={{ width: `${((index + 1) / steps.length) * 100}%` }}
          />
        </div>
      ) : null}
    </header>
  );
  const bottom = (
    <div className="fm-page-bar border-t border-line bg-surface px-4 pt-3 pb-4">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">
        <Button
          icon="book-open"
          block
          onClick={() => {
            setSheet(true);
          }}
        >
          Ingrédients
        </Button>
        <div className="flex gap-2">
          <Button
            className="flex-1"
            disabled={index === 0}
            onClick={() => {
              setIndex(index - 1);
            }}
          >
            Précédente
          </Button>
          <Button
            variant="primary"
            className="flex-[2]"
            onClick={() => {
              if (last) leave();
              else setIndex(index + 1);
            }}
          >
            {last ? "Terminer" : "Suivante"}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <PageChrome top={top} bottom={bottom} />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-5 py-7">
        {!step ? (
          <EmptyState icon="book-open" title="Pas d'étape">
            Cette recette n'a pas encore d'étape : ses ingrédients sont dans la liste.
          </EmptyState>
        ) : (
          <>
            {step.block ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="second" icon={step.block.linked ? "link" : undefined}>
                  {step.block.title}
                </Badge>
                {step.block.amount ? (
                  <span className="text-sm text-ink-muted">
                    {step.block.amount} pour {portions}
                  </span>
                ) : null}
              </div>
            ) : null}
            <p className="m-0 font-display text-[26px] leading-9 font-semibold" aria-live="polite">
              {step.text}
            </p>
            {step.ingredients.length > 0 ? (
              <section
                aria-label="Pour cette étape"
                className="flex flex-col gap-0.5 rounded-lg border border-line bg-surface-raised p-3"
              >
                <span className={LABEL}>Pour cette étape</span>
                {step.ingredients.map(row)}
              </section>
            ) : null}
          </>
        )}
        {awake ? (
          <span className="inline-flex items-center gap-2 text-sm text-ink-muted">
            <Icon name="sparkles" size={16} />
            Écran maintenu allumé
          </span>
        ) : null}
      </div>
      <Sheet
        open={sheet}
        onClose={() => {
          setSheet(false);
        }}
        title={`Ingrédients pour ${portions}`}
      >
        <div className="flex flex-col gap-1">
          {groups.map((group, i) => (
            <div key={i} className="flex flex-col gap-1">
              {groups.length > 1 ? (
                <span
                  className={`${LABEL} pt-3 first:pt-1`}
                  style={group.linked ? { color: "var(--second-text)" } : undefined}
                >
                  {group.amount ? `${group.title} · ${group.amount}` : group.title || recipe.title}
                </span>
              ) : null}
              {group.ingredients.map(row)}
            </div>
          ))}
          <span className="pt-2 text-sm text-ink-muted">
            Coche ce que tu as sorti. Rien n'est enregistré sur la recette.
          </span>
        </div>
      </Sheet>
    </>
  );
}

export function CookPage() {
  const { spaceId = "", recipeId = "" } = useParams();
  const [params] = useSearchParams();
  const recipe = useQuery(recipeQuery(spaceId, recipeId));
  const units = useQuery(unitsQuery);
  if (recipe.isError) return <RecipeNotFound spaceId={spaceId} />;
  if (!recipe.data || !units.data) return <Skeleton />;
  const asked = Number(params.get("servings"));
  const servings = Number.isFinite(asked) && asked > 0 ? asked : recipe.data.yieldQuantity;
  return (
    <CookView
      key={recipe.data.id}
      spaceId={spaceId}
      recipe={recipe.data}
      units={units.data}
      servings={servings}
    />
  );
}
