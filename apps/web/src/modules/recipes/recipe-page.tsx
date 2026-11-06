// E-RECETTE : detail d'une recette (F-REC-1), portions avec mise a l'echelle,
// ingredients a cocher, etapes ; blocs lies deplies a l'echelle (D24) ;
// modifier, partager, retirer et supprimer selon les droits (D57, D81, F-REC-9).
import { linkFactor, type LinkedBlock, type Recipe, type RecipeBlock, type Unit } from "@fm/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { FormAlert } from "../../core/access/auth-layout.tsx";
import { spaceQuery } from "../../core/session/queries.ts";
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
import { LINK_STATUS_TITLES } from "./draft.ts";
import { formatMinutes, joinNames, scaledAmount } from "./format.ts";
import { recipeQuery, recipesKey, unitsQuery } from "./queries.ts";
import { AdaptedFromNotice, AdaptSheet } from "./adaptation.tsx";
import { RemoveFromSpaceSheet, ShareSheet } from "./sharing.tsx";

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
      {recipe.sharedIn.length > 0 ? (
        <p>Elle disparaît aussi de {joinNames(recipe.sharedIn.map((space) => space.name))}.</p>
      ) : null}
      {recipe.usedBy > 0 ? (
        <p>
          Elle est utilisée dans {recipe.usedBy} {recipe.usedBy > 1 ? "recettes" : "recette"} :
          leurs blocs afficheront « Recette supprimée ».
        </p>
      ) : null}
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

function LocalBlockView({
  block,
  label,
  units,
  scale,
}: {
  block: Extract<RecipeBlock, { kind: "LOCAL" }>;
  label: string;
  units: readonly Unit[];
  scale: number;
}) {
  return (
    <section className="fm-block" aria-label={block.title ?? label}>
      <div className="fm-block-head">
        <div className="flex min-w-0 flex-1 flex-col">
          {block.title ? <span className="fm-block-kind">Bloc</span> : null}
          <b>{block.title ?? "Ingrédients et étapes"}</b>
        </div>
      </div>
      <BlockBody block={block} units={units} scale={scale} />
    </section>
  );
}

function BlockBody({
  block,
  units,
  scale,
}: {
  block: Extract<RecipeBlock, { kind: "LOCAL" }>;
  units: readonly Unit[];
  scale: number;
}) {
  return (
    <div className="fm-block-body">
      <div>
        {block.ingredients.map((line, i) => (
          <IngredientRow
            key={i}
            amount={scaledAmount(line, units, scale)}
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
  );
}

/** Bloc lie (lien vivant) : quantite utilisee, sous-recette repliable a l'echelle. */
function LinkedBlockView({
  block,
  units,
  scale,
  spaceId,
}: {
  block: LinkedBlock;
  units: readonly Unit[];
  scale: number;
  spaceId: string;
}) {
  const [open, setOpen] = useState(false);
  const { data: space } = useQuery(spaceQuery(spaceId));
  const sub = block.recipe;
  const title = sub?.title ?? LINK_STATUS_TITLES[block.status === "HIDDEN" ? "HIDDEN" : "DELETED"];
  const unitOf = (id: string | null) => units.find((u) => u.id === id) ?? null;
  const subScale = sub
    ? scale *
      linkFactor(
        { quantity: block.quantity, unit: unitOf(block.unitId) },
        { yieldQuantity: sub.yieldQuantity, yieldUnit: unitOf(sub.yieldUnitId) }
      )
    : 0;
  return (
    <section className="fm-block fm-block-linked" aria-label={title}>
      <div className="fm-block-head">
        <Icon name={sub ? "link" : "lock"} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="fm-block-kind">Recette liée</span>
          <b>{sub ? <Link to={`/s/${spaceId}/recipes/${sub.id}`}>{sub.title}</Link> : title}</b>
        </div>
        <span className="fm-block-qty">{scaledAmount(block, units, scale)}</span>
        {sub ? (
          <IconButton
            icon={open ? "chevron-down" : "chevron-right"}
            label={`${open ? "Replier" : "Déplier"} ${sub.title}`}
            aria-expanded={open}
            onClick={() => {
              setOpen(!open);
            }}
          />
        ) : null}
      </div>
      {!sub ? (
        <div className="fm-block-body">
          <p className="m-0 text-sm text-ink-muted">
            {block.status === "HIDDEN"
              ? `Cette recette liée n'est pas visible dans ${space?.name ?? "cet espace"} : ses ingrédients et ses étapes ne s'affichent pas ici.`
              : "Cette recette liée a été supprimée : ses ingrédients et ses étapes ne s'affichent plus."}
          </p>
        </div>
      ) : open ? (
        <div className="fm-stack p-3">
          {sub.blocks.map((child, i) =>
            child.kind === "RECIPE" ? (
              <LinkedBlockView
                key={i}
                block={child}
                units={units}
                scale={subScale}
                spaceId={spaceId}
              />
            ) : sub.blocks.length > 1 || child.title ? (
              <LocalBlockView
                key={i}
                block={child}
                label={`${sub.title}, bloc ${i + 1}`}
                units={units}
                scale={subScale}
              />
            ) : (
              <BlockBody key={i} block={child} units={units} scale={subScale} />
            )
          )}
        </div>
      ) : null}
    </section>
  );
}

function BlockView({
  block,
  index,
  titled,
  units,
  scale,
  spaceId,
}: {
  block: RecipeBlock;
  index: number;
  titled: boolean;
  units: readonly Unit[];
  scale: number;
  spaceId: string;
}) {
  if (block.kind === "RECIPE") {
    return <LinkedBlockView block={block} units={units} scale={scale} spaceId={spaceId} />;
  }
  return (
    <LocalBlockView
      block={block}
      label={titled ? `Bloc ${index + 1}` : "Ingrédients et étapes"}
      units={units}
      scale={scale}
    />
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
  const { data: space } = useQuery(spaceQuery(spaceId));
  const [servings, setServings] = useState(recipe.yieldQuantity);
  const [sheet, setSheet] = useState<"delete" | "share" | "remove" | "adapt" | null>(null);
  const spaceName = space?.name ?? "";
  const sharedHere = recipe.homeSpaceId !== spaceId;
  const close = () => {
    setSheet(null);
  };
  const yieldUnit = units.find((u) => u.id === recipe.yieldUnitId);
  const titled = recipe.blocks.length > 1;
  const composed = recipe.blocks.some((block) => block.kind === "RECIPE");

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
              par {recipe.author.username}
              {sharedHere ? ` · ${recipe.homeSpace.name}` : ""} · révision {recipe.currentRevision}
            </span>
            <AdaptedFromNotice spaceId={spaceId} recipe={recipe} />
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
              { id: "share", label: "Partager dans un espace", icon: "share" },
              { id: "adapt", label: "Adapter pour un espace", icon: "git-branch" },
              ...(recipe.adaptedFrom && !recipe.adaptedFrom.deleted
                ? [
                    {
                      id: "compare" as const,
                      label: "Comparer avec l'original",
                      icon: "copy" as const,
                    },
                  ]
                : []),
              { id: "history", label: "Voir l'historique", icon: "clock" },
              ...(recipe.can.removeFromSpace && sharedHere
                ? [{ id: "remove" as const, label: `Retirer de ${spaceName}`, icon: "x" as const }]
                : []),
              ...(recipe.can.delete
                ? [
                    "-" as const,
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
              if (id === "history" || id === "compare") {
                void navigate(`/s/${spaceId}/recipes/${recipe.id}/${id}`);
              } else setSheet(id);
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
        {recipe.isBase || composed || recipe.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {recipe.isBase ? <Badge tone="second">Base</Badge> : null}
            {composed ? (
              <Badge tone="second" icon="link">
                Composée
              </Badge>
            ) : null}
            {recipe.tags.map((tag) => (
              <Badge key={tag.id} tone={tag.scope === "GLOBAL" ? "accent" : "neutral"}>
                {tag.name}
              </Badge>
            ))}
          </div>
        ) : null}
        {recipe.blocks.map((block, index) => (
          <BlockView
            key={index}
            block={block}
            index={index}
            titled={titled}
            units={units}
            scale={servings / recipe.yieldQuantity}
            spaceId={spaceId}
          />
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
      <DeleteSheet spaceId={spaceId} recipe={recipe} open={sheet === "delete"} onClose={close} />
      <ShareSheet spaceId={spaceId} recipe={recipe} open={sheet === "share"} onClose={close} />
      <AdaptSheet spaceId={spaceId} recipe={recipe} open={sheet === "adapt"} onClose={close} />
      <RemoveFromSpaceSheet
        spaceId={spaceId}
        spaceName={spaceName}
        recipe={recipe}
        open={sheet === "remove"}
        onClose={close}
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
