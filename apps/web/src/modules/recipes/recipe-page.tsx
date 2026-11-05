// E-RECETTE : detail d'une recette (F-REC-1), portions avec mise a l'echelle,
// ingredients a cocher, etapes ; modifier et supprimer selon les droits (D57).
import type { Recipe, Unit } from "@fm/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { FormAlert } from "../../core/access/auth-layout.tsx";
import { PageChrome } from "../../core/shell/page-chrome.tsx";
import { errorMessage } from "../../i18n/index.ts";
import { api } from "../../lib/api.ts";
import { TopBar } from "../../patterns/top-bar.tsx";
import { ActionMenu } from "../../ui/action-menu.tsx";
import { Button, IconButton } from "../../ui/button.tsx";
import { Stepper } from "../../ui/controls.tsx";
import { Badge, EmptyState, Skeleton } from "../../ui/display.tsx";
import { Icon } from "../../ui/icon.tsx";
import { Sheet, SheetFooter } from "../../ui/sheet.tsx";
import { useToast } from "../../ui/use-toast.ts";
import { IngredientRow } from "./components/ingredient-row.tsx";
import { formatMinutes, ingredientAmount } from "./format.ts";
import { recipeQuery, recipesKey, unitsQuery } from "./queries.ts";

export function RecipeNotFound({ spaceId }: { spaceId: string }) {
  return (
    <div className="p-4">
      <EmptyState
        icon="search"
        title="Recette introuvable"
        action={
          <Link to={`/s/${spaceId}/recipes`} className="fm-btn fm-btn-primary">
            Retour aux recettes
          </Link>
        }
      >
        Elle a été supprimée, ou elle n'est pas visible dans cet espace.
      </EmptyState>
    </div>
  );
}

function DeleteSheet({
  spaceId,
  recipe,
  open,
  onClose,
}: {
  spaceId: string;
  recipe: Recipe;
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [failure, setFailure] = useState<string>();
  const [pending, setPending] = useState(false);
  const confirm = async () => {
    setPending(true);
    try {
      await api.delete(`/spaces/${spaceId}/recipes/${recipe.id}`);
      queryClient.removeQueries({ queryKey: recipeQuery(spaceId, recipe.id).queryKey });
      await queryClient.invalidateQueries({ queryKey: [...recipesKey(spaceId), "list"] });
      toast("Recette supprimée", { tone: "success" });
      void navigate(`/s/${spaceId}/recipes`, { replace: true });
    } catch (error) {
      setFailure(errorMessage(error));
      setPending(false);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title={`Supprimer « ${recipe.title} » ?`}>
      <p>La recette et son historique disparaissent pour tous les membres de l'espace.</p>
      <FormAlert message={failure} />
      <SheetFooter>
        <Button onClick={onClose}>Annuler</Button>
        <Button variant="danger" disabled={pending} onClick={() => void confirm()}>
          Supprimer
        </Button>
      </SheetFooter>
    </Sheet>
  );
}

function RecipeView({
  spaceId,
  recipe,
  units,
}: {
  spaceId: string;
  recipe: Recipe;
  units: readonly Unit[];
}) {
  const navigate = useNavigate();
  const [servings, setServings] = useState(recipe.yieldQuantity);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const yieldUnit = units.find((u) => u.id === recipe.yieldUnitId);
  const titled = recipe.blocks.length > 1;

  return (
    <>
      <PageChrome
        top={
          <TopBar
            title="Recette"
            onBack={() => {
              void navigate(`/s/${spaceId}/recipes`);
            }}
          />
        }
      />
      <div
        className="h-[150px]"
        aria-hidden="true"
        style={{ background: "linear-gradient(140deg, var(--accent-soft), var(--surface))" }}
      />
      <article className="fm-stack mx-auto w-full max-w-3xl p-4" aria-labelledby="recipe-title">
        <div className="flex items-start gap-1">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h1 id="recipe-title" className="m-0 font-display text-[26px] leading-8 font-bold">
              {recipe.title}
            </h1>
            <span className="text-sm text-ink-muted">
              par {recipe.author.username} · révision {recipe.currentRevision}
            </span>
          </div>
          {recipe.can.edit ? (
            <Link
              to={`/s/${spaceId}/recipes/${recipe.id}/edit`}
              className="fm-btn fm-btn-secondary fm-btn-sm"
            >
              <Icon name="pencil" />
              Modifier
            </Link>
          ) : null}
          <ActionMenu
            label="Actions de la recette"
            trigger={<IconButton icon="more" label="Plus d'actions" />}
            items={[
              { id: "history", label: "Voir l'historique", icon: "clock" },
              ...(recipe.can.delete
                ? [
                    {
                      id: "delete" as const,
                      label: "Supprimer",
                      icon: "trash" as const,
                      danger: true,
                    },
                  ]
                : []),
            ]}
            onSelect={(id) => {
              if (id === "delete") setDeleteOpen(true);
              else void navigate(`/s/${spaceId}/recipes/${recipe.id}/history`);
            }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Stepper
            label="Portions"
            value={servings}
            min={1}
            max={Math.max(100, recipe.yieldQuantity)}
            unit={yieldUnit ? yieldUnit.abbreviation : "pers."}
            onChange={setServings}
          />
          {recipe.totalMinutes !== null ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-ink-muted">
              <Icon name="clock" size={16} />
              {formatMinutes(recipe.totalMinutes)}
            </span>
          ) : null}
        </div>
        {recipe.isBase || recipe.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {recipe.isBase ? <Badge tone="second">Base</Badge> : null}
            {recipe.tags.map((tag) => (
              <Badge key={tag.id} tone={tag.scope === "GLOBAL" ? "accent" : "neutral"}>
                {tag.name}
              </Badge>
            ))}
          </div>
        ) : null}
        {recipe.blocks.map((block, index) => (
          <section
            key={index}
            className="fm-block"
            aria-label={block.title ?? (titled ? `Bloc ${index + 1}` : "Ingrédients et étapes")}
          >
            <div className="fm-block-head">
              <div className="flex min-w-0 flex-1 flex-col">
                {block.title ? <span className="fm-block-kind">Bloc</span> : null}
                <b>{block.title ?? "Ingrédients et étapes"}</b>
              </div>
            </div>
            <div className="fm-block-body">
              <div>
                {block.ingredients.map((line, i) => (
                  <IngredientRow
                    key={i}
                    amount={ingredientAmount(line, units, recipe.yieldQuantity, servings)}
                    name={line.name}
                    note={line.note}
                  />
                ))}
              </div>
              {block.steps.length > 0 ? (
                <ol>
                  {block.steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              ) : null}
            </div>
          </section>
        ))}
        {recipe.notes ? (
          <section className="fm-stack">
            <h2 className="m-0 font-display text-base font-semibold">Notes</h2>
            <p className="m-0 whitespace-pre-line">{recipe.notes}</p>
          </section>
        ) : null}
        {recipe.sourceUrl ? (
          <a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer nofollow">
            Voir la source
          </a>
        ) : null}
      </article>
      <DeleteSheet
        spaceId={spaceId}
        recipe={recipe}
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
        }}
      />
    </>
  );
}

export function RecipePage() {
  const { spaceId = "", recipeId = "" } = useParams();
  const recipe = useQuery(recipeQuery(spaceId, recipeId));
  const units = useQuery(unitsQuery);
  if (recipe.isError) return <RecipeNotFound spaceId={spaceId} />;
  if (!recipe.data || !units.data) return <Skeleton />;
  return (
    <RecipeView key={recipe.data.id} spaceId={spaceId} recipe={recipe.data} units={units.data} />
  );
}
