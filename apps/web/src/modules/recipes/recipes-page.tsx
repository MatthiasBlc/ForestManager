// E-RECETTES : recettes de l'espace (F-REC-11) avec recherche, filtres par tag,
// "Bases" ; "Mes recettes" de tous les espaces (D82) ; recettes partagees ;
// bandeau des demandes de partage ; etats vide, chargement, erreur ; F-AJOUT-RECETTE.
import {
  normalizeName,
  type Recipe,
  type RecipeSummary,
  type SpaceSummary,
  type Unit,
} from "@fm/shared";
import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { meQuery, spaceQuery, spacesQuery } from "../../core/session/queries.ts";
import { errorMessage } from "../../i18n/index.ts";
import { isNetworkError } from "../../lib/api.ts";
import { useOnline } from "../../pwa/use-online.ts";
import { useWriteGuard } from "../../pwa/use-write-guard.ts";
import { Button } from "../../ui/button.tsx";
import { Chip } from "../../ui/controls.tsx";
import { EmptyState, Skeleton } from "../../ui/display.tsx";
import { Icon, type IconName } from "../../ui/icon.tsx";
import { Sheet } from "../../ui/sheet.tsx";
import { RecipeCard, type CardBadge } from "./components/recipe-card.tsx";
import { recipeMeta } from "./format.ts";
import { ImportTextSheet, ImportUrlSheet, type ImportSheet } from "./import-sheets.tsx";
import {
  globalTagsQuery,
  recipesKey,
  recipesQuery,
  spaceTagsQuery,
  unitsQuery,
} from "./queries.ts";
import { RecipeActionsSheet } from "./recipe-actions-sheet.tsx";
import { ShareRequestsBanner } from "./sharing.tsx";
import { SuggestionsToDecideBanner } from "./suggestions.tsx";
import { useDebounced } from "./use-debounced.ts";

/**
 * Hors de son espace d'origine : "Partagee" dans un espace de partage, nom de
 * l'origine dans "Mes recettes".
 */
function badgesOf(
  recipe: RecipeSummary,
  spaceId: string,
  mine: boolean,
  spaces: readonly SpaceSummary[]
): CardBadge[] {
  const badges: CardBadge[] = [];
  if (recipe.homeSpaceId !== spaceId) {
    const home = spaces.find((space) => space.id === recipe.homeSpaceId);
    if (!mine) badges.push({ label: "Partagée", tone: "accent", icon: "share" });
    else if (home) badges.push({ label: home.name, tone: "neutral" });
  }
  if (recipe.isComposed) badges.push({ label: "Composée", tone: "second", icon: "link" });
  if (recipe.isBase) badges.push({ label: "Base", tone: "second" });
  return badges;
}

function AddRecipeSheet({
  open,
  onClose,
  onImport,
  spaceId,
  spaceName,
}: {
  open: boolean;
  onClose: () => void;
  onImport: (sheet: Exclude<ImportSheet, null>) => void;
  spaceId: string;
  spaceName: string;
}) {
  const choices: {
    to?: string;
    sheet?: Exclude<ImportSheet, null>;
    icon: IconName;
    title: string;
    text: string;
  }[] = [
    {
      to: `/s/${spaceId}/recipes/new`,
      icon: "pencil",
      title: "Saisir",
      text: "Écrire la recette toi-même",
    },
    {
      sheet: "url",
      icon: "link",
      title: "Importer un lien",
      text: "Une page de recette sur le web",
    },
    {
      sheet: "text",
      icon: "book-open",
      title: "Coller un texte",
      text: "Depuis un mail, une note, un PDF",
    },
  ];
  return (
    <Sheet open={open} onClose={onClose} title={`Nouvelle recette dans ${spaceName}`}>
      <div className="fm-stack">
        {choices.map((choice) => {
          const content = (
            <>
              <span className="fm-option-icon">
                <Icon name={choice.icon} />
              </span>
              <span className="fm-option-text">
                <b>{choice.title}</b>
                <small>{choice.text}</small>
              </span>
            </>
          );
          return choice.to ? (
            <Link key={choice.title} to={choice.to} className="fm-option" onClick={onClose}>
              {content}
              <Icon name="chevron-right" className="fm-option-go" />
            </Link>
          ) : (
            <button
              key={choice.title}
              type="button"
              className="fm-option w-full text-left"
              onClick={() => {
                if (choice.sheet) onImport(choice.sheet);
              }}
            >
              {content}
              <Icon name="chevron-right" className="fm-option-go" />
            </button>
          );
        })}
        <small className="text-ink-muted">
          Dans tous les cas, tu vérifies tout dans l'éditeur avant d'enregistrer.
        </small>
      </div>
    </Sheet>
  );
}

/** Recette lue sur l'appareil, avec l'espace ou elle a ete ouverte (pour la rouvrir hors ligne). */
interface OfflineRecipe {
  spaceId: string;
  recipe: Recipe;
}

/**
 * Hors ligne [D35] : recettes ouvertes sur cet appareil, celles de l'espace, ou
 * toutes celles de l'utilisateur pour "Mes recettes".
 */
function offlineRecipes(
  client: QueryClient,
  spaceId: string,
  mine: boolean,
  meId: string | undefined
): OfflineRecipe[] {
  const found = new Map<string, OfflineRecipe>();
  const prefix = mine ? ["spaces"] : [...recipesKey(spaceId), "detail"];
  for (const [key, recipe] of client.getQueriesData<Recipe>({ queryKey: prefix })) {
    const [, keySpace, module, kind] = key;
    if (key.length !== 5 || module !== "recipes" || kind !== "detail" || !recipe) continue;
    if (typeof keySpace !== "string" || (mine && recipe.author.id !== meId)) continue;
    if (!found.has(recipe.id)) found.set(recipe.id, { spaceId: keySpace, recipe });
  }
  return [...found.values()].sort((a, b) => a.recipe.title.localeCompare(b.recipe.title, "fr"));
}

function toSummary(recipe: Recipe): RecipeSummary {
  return { ...recipe, isComposed: recipe.blocks.some((block) => block.kind === "RECIPE") };
}

function RecipeGrid({
  recipes,
  units,
  badges,
  onOpen,
  onActions,
}: {
  recipes: readonly RecipeSummary[];
  units: readonly Unit[];
  badges: (recipe: RecipeSummary) => CardBadge[];
  onOpen: (recipe: RecipeSummary) => void;
  onActions: (recipe: RecipeSummary) => void;
}) {
  return (
    <div className="fm-cq">
      <div className="fm-grid">
        {recipes.map((recipe) => (
          <RecipeCard
            key={recipe.id}
            title={recipe.title}
            meta={recipeMeta(recipe, units)}
            image={recipe.imageUrl}
            badges={badges(recipe)}
            onOpen={() => {
              onOpen(recipe);
            }}
            onActions={() => {
              onActions(recipe);
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function RecipesPage({ mine = false }: { mine?: boolean }) {
  const { spaceId = "" } = useParams();
  const navigate = useNavigate();
  const space = useQuery(spaceQuery(spaceId));
  const spaces = useQuery(spacesQuery);
  const units = useQuery(unitsQuery);
  const globalTags = useQuery(globalTagsQuery);
  const spaceTags = useQuery(spaceTagsQuery(spaceId));
  const [search, setSearch] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [baseOnly, setBaseOnly] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [importSheet, setImportSheet] = useState<ImportSheet>(null);
  const [actionsFor, setActionsFor] = useState<{ spaceId: string; recipe: RecipeSummary }>();
  const q = useDebounced(search.trim());
  const online = useOnline();
  const guard = useWriteGuard();
  const queryClient = useQueryClient();
  const me = useQuery(meQuery);
  const list = useInfiniteQuery({
    ...recipesQuery(spaceId, { q, tagIds, base: baseOnly, mine }),
    // Pendant une recherche, la liste precedente reste affichee (pas de clignotement).
    placeholderData: keepPreviousData,
  });

  const spaceName = space.data?.name ?? "";
  const filtered = q !== "" || tagIds.length > 0 || baseOnly;
  const recipes = list.data?.pages.flatMap((page) => page.data) ?? [];
  const tags = [...(globalTags.data ?? []), ...(spaceTags.data ?? [])];
  // "Mes recettes" ouvre chaque recette dans son espace d'origine.
  const open = (recipe: RecipeSummary) => {
    void navigate(`/s/${mine ? recipe.homeSpaceId : spaceId}/recipes/${recipe.id}`);
  };
  const add = () => {
    setAddOpen(true);
  };
  const showActions = (recipe: RecipeSummary) => {
    setActionsFor({ spaceId: mine ? recipe.homeSpaceId : spaceId, recipe });
  };

  let content;
  if (!online) {
    const term = normalizeName(q);
    const available = offlineRecipes(queryClient, spaceId, mine, me.data?.id);
    const shown = available.filter(
      ({ recipe }) =>
        (!term || normalizeName(recipe.title).includes(term)) &&
        (!baseOnly || recipe.isBase) &&
        tagIds.every((id) => recipe.tags.some((tag) => tag.id === id))
    );
    content =
      available.length === 0 ? (
        <EmptyState icon="wifi-off" title="Aucune recette disponible hors ligne">
          Les recettes ouvertes avec le réseau restent lisibles ici pendant 14 jours.
        </EmptyState>
      ) : (
        <>
          <p className="m-0 text-sm text-ink-muted">
            Disponibles hors ligne : {available.length}{" "}
            {available.length > 1 ? "recettes ouvertes" : "recette ouverte"} récemment.
          </p>
          <RecipeGrid
            recipes={shown.map(({ recipe }) => toSummary(recipe))}
            units={units.data ?? []}
            badges={(recipe) => [
              ...badgesOf(recipe, spaceId, mine, spaces.data ?? []),
              { label: "Hors ligne", tone: "warning" },
            ]}
            onOpen={(recipe) => {
              const where = available.find((item) => item.recipe.id === recipe.id);
              void navigate(`/s/${where?.spaceId ?? spaceId}/recipes/${recipe.id}`);
            }}
            onActions={(recipe) => {
              const where = available.find((item) => item.recipe.id === recipe.id);
              setActionsFor({ spaceId: where?.spaceId ?? spaceId, recipe });
            }}
          />
        </>
      );
  } else if (list.isError && !(list.data && isNetworkError(list.error))) {
    content = (
      <EmptyState
        icon="triangle-alert"
        title="Impossible de charger les recettes"
        action={<Button onClick={() => void list.refetch()}>Réessayer</Button>}
      >
        {errorMessage(list.error)}
      </EmptyState>
    );
  } else if (!list.data || !units.data) {
    content = <Skeleton kind="card" count={4} label="Chargement des recettes…" />;
  } else if (recipes.length === 0 && filtered) {
    content = (
      <EmptyState
        icon="search"
        title="Aucune recette ne correspond"
        action={
          <Button
            onClick={() => {
              setSearch("");
              setTagIds([]);
              setBaseOnly(false);
            }}
          >
            Effacer les filtres
          </Button>
        }
      />
    );
  } else if (recipes.length === 0) {
    content = (
      <EmptyState
        icon="book-open"
        title={mine ? "Pas encore de recette à toi" : `Pas encore de recette dans ${spaceName}`}
        action={
          <Button icon="plus" onClick={add}>
            Nouvelle recette
          </Button>
        }
      >
        {space.data?.kind === "GROUP"
          ? space.data.memberCount > 1
            ? `Ajoute une recette : les ${String(space.data.memberCount)} membres la verront ici.`
            : "Ajoute une recette : les membres que tu inviteras la verront ici."
          : "Ajoute ta première recette : elle reste privée tant que tu ne la partages pas."}
      </EmptyState>
    );
  } else {
    content = (
      <>
        <RecipeGrid
          recipes={recipes}
          units={units.data}
          badges={(recipe) => badgesOf(recipe, spaceId, mine, spaces.data ?? [])}
          onOpen={open}
          onActions={showActions}
        />
        {list.hasNextPage ? (
          <Button
            className="self-center"
            disabled={list.isFetchingNextPage}
            onClick={() => void list.fetchNextPage()}
          >
            Voir plus
          </Button>
        ) : null}
      </>
    );
  }

  return (
    <div className="fm-stack mx-auto w-full max-w-6xl p-4">
      <div className="flex items-center gap-2">
        <h1 className="sr-only m-0 flex-1 font-display text-2xl font-bold md:not-sr-only">
          {mine ? "Mes recettes" : "Recettes"}
        </h1>
        <Button
          variant="primary"
          icon="plus"
          className="flex-1 md:flex-none"
          onClick={add}
          {...guard}
        >
          Nouvelle recette
        </Button>
      </div>
      {mine || space.data?.kind === "GROUP" ? (
        <>
          <ShareRequestsBanner spaceId={spaceId} />
          <SuggestionsToDecideBanner spaceId={spaceId} />
        </>
      ) : null}
      <div className="flex items-center gap-2">
        <input
          type="search"
          className="fm-input flex-1"
          aria-label="Rechercher une recette"
          placeholder="Rechercher une recette"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
          }}
        />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filtres">
        <Chip
          selected={!filtered}
          onToggle={() => {
            setTagIds([]);
            setBaseOnly(false);
            setSearch("");
          }}
        >
          Toutes
        </Chip>
        {tags.map((tag) => (
          <Chip
            key={tag.id}
            selected={tagIds.includes(tag.id)}
            onToggle={(on) => {
              setTagIds((ids) => (on ? [...ids, tag.id] : ids.filter((id) => id !== tag.id)));
            }}
          >
            {tag.name}
          </Chip>
        ))}
        <Chip selected={baseOnly} onToggle={setBaseOnly}>
          Bases
        </Chip>
      </div>
      {content}
      <AddRecipeSheet
        open={addOpen}
        onClose={() => {
          setAddOpen(false);
        }}
        onImport={(sheet) => {
          setAddOpen(false);
          setImportSheet(sheet);
        }}
        spaceId={spaceId}
        spaceName={spaceName}
      />
      <ImportUrlSheet
        open={importSheet === "url"}
        onClose={() => {
          setImportSheet(null);
        }}
        onPasteText={() => {
          setImportSheet("text");
        }}
        spaceId={spaceId}
      />
      <ImportTextSheet
        open={importSheet === "text"}
        onClose={() => {
          setImportSheet(null);
        }}
        spaceId={spaceId}
      />
      {actionsFor ? (
        <RecipeActionsSheet
          key={actionsFor.recipe.id}
          spaceId={actionsFor.spaceId}
          recipeId={actionsFor.recipe.id}
          title={actionsFor.recipe.title}
          onClose={() => {
            setActionsFor(undefined);
          }}
          // Supprimee ou retiree : la liste affichee (ici ou "Mes recettes") se recharge.
          onGone={() =>
            void queryClient.invalidateQueries({ queryKey: [...recipesKey(spaceId), "list"] })
          }
        />
      ) : null}
    </div>
  );
}
