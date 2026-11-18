// E-RECETTES : recettes de l'espace (F-REC-11) avec recherche et feuille de
// filtres (tags par famille, "Bases", D216) ; dans l'espace perso, "Mes recettes" de tous les espaces (D82), filtrees
// par espace d'origine (onglet unique, D207) ; recettes partagees ;
// bandeau des demandes de partage ; etats vide, chargement, erreur ; F-AJOUT-RECETTE.
import {
  matchesTagFilter,
  normalizeName,
  type Recipe,
  type RecipeSummary,
  type RecipeSort,
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
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router";

import { meQuery, spaceQuery, spacesQuery } from "../../core/session/queries.ts";
import { errorMessage } from "../../i18n/index.ts";
import { isNetworkError } from "../../lib/api.ts";
import { useOnline } from "../../pwa/use-online.ts";
import { useWriteGuard } from "../../pwa/use-write-guard.ts";
import { Button, IconButton } from "../../ui/button.tsx";
import { EmptyState, Skeleton } from "../../ui/display.tsx";
import { Icon, type IconName } from "../../ui/icon.tsx";
import { Sheet } from "../../ui/sheet.tsx";
import { AddMineSheet } from "./add-mine-sheet.tsx";
import { RecipeCard, type CardBadge } from "./components/recipe-card.tsx";
import { ActiveFilters, FiltersButton, FiltersSheet, type ActiveFilter } from "./filters-sheet.tsx";
import { recipeMeta } from "./format.ts";
import { ImportTextSheet, ImportUrlSheet, type ImportSheet } from "./import-sheets.tsx";
import { recipesKey, recipesQuery, tagCatalogQuery, unitsQuery } from "./queries.ts";
import { RecipeActionsSheet } from "./recipe-actions-sheet.tsx";
import { ShareRequestsBanner } from "./sharing.tsx";
import { SuggestionsToDecideBanner } from "./suggestions.tsx";
import {
  DEFAULT_RECIPE_SORT,
  RECIPE_SORT_LABELS,
  readRecipeSort,
  sortRecipes,
  writeRecipeSort,
} from "./sort.ts";
import { homeLabel, sortByFamily } from "./tag-groups.ts";
import { useDebounced } from "../../lib/use-debounced.ts";
import { useUrlFlag } from "../../lib/use-url-flag.ts";

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

/** Etape de la feuille d'ajout : choix (groupe), creation, ou "Depuis mes recettes". */
type AddStep = "root" | "create" | "mine";

/**
 * F-AJOUT-RECETTE [D208] : dans un espace de groupe, "Depuis mes recettes" puis
 * "Creer" (sous-menu) ; dans l'espace perso, directement la creation.
 */
function AddRecipeSheet({
  step,
  onStep,
  onClose,
  onImport,
  spaceId,
  spaceName,
  group,
}: {
  step: "root" | "create" | null;
  onStep: (step: AddStep) => void;
  onClose: () => void;
  onImport: (sheet: Exclude<ImportSheet, null>) => void;
  spaceId: string;
  spaceName: string;
  group: boolean;
}) {
  const option = (icon: IconName, title: string, text: string) => (
    <>
      <span className="fm-option-icon">
        <Icon name={icon} />
      </span>
      <span className="fm-option-text">
        <b>{title}</b>
        <small>{text}</small>
      </span>
    </>
  );
  if (step === "root") {
    return (
      <Sheet open onClose={onClose} title={`Ajouter une recette dans ${spaceName}`}>
        <div className="fm-stack">
          <button
            type="button"
            className="fm-option fm-option-lead w-full text-left"
            onClick={() => {
              onStep("mine");
            }}
          >
            {option(
              "book-open",
              "Depuis mes recettes",
              "Celles que tu as déjà, en quelques cases à cocher"
            )}
            <Icon name="chevron-right" className="fm-option-go" />
          </button>
          <button
            type="button"
            className="fm-option w-full text-left"
            onClick={() => {
              onStep("create");
            }}
          >
            {option("plus", "Créer", "La saisir, importer un lien ou coller un texte")}
            <Icon name="chevron-right" className="fm-option-go" />
          </button>
        </div>
      </Sheet>
    );
  }
  return (
    <Sheet open={step === "create"} onClose={onClose} title="Créer une recette">
      <div className="fm-stack">
        {group ? (
          <IconButton
            icon="arrow-left"
            label="Retour"
            onClick={() => {
              onStep("root");
            }}
          />
        ) : null}
        <Link to={`/s/${spaceId}/recipes/new`} className="fm-option" onClick={onClose}>
          {option("pencil", "Saisir", "Écrire la recette toi-même")}
          <Icon name="chevron-right" className="fm-option-go" />
        </Link>
        <button
          type="button"
          className="fm-option w-full text-left"
          onClick={() => {
            onImport("url");
          }}
        >
          {option("link", "Un lien", "Une page de recette sur le web")}
          <Icon name="chevron-right" className="fm-option-go" />
        </button>
        <button
          type="button"
          className="fm-option w-full text-left"
          onClick={() => {
            onImport("text");
          }}
        >
          {option("book-open", "Un texte collé", "Depuis un mail, une note, un PDF")}
          <Icon name="chevron-right" className="fm-option-go" />
        </button>
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
  return [...found.values()];
}

function toSummary(recipe: Recipe): RecipeSummary {
  return { ...recipe, isComposed: recipe.blocks.some((block) => block.kind === "RECIPE") };
}

function RecipeGrid({
  recipes,
  units,
  badges,
  tags,
  onOpen,
  onActions,
}: {
  recipes: readonly RecipeSummary[];
  units: readonly Unit[];
  badges: (recipe: RecipeSummary) => CardBadge[];
  tags: (recipe: RecipeSummary) => string[];
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
            tags={tags(recipe)}
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

export function RecipesPage() {
  const { spaceId = "" } = useParams();
  const navigate = useNavigate();
  const space = useQuery(spaceQuery(spaceId));
  const mine = space.data?.kind === "PERSONAL";
  const [homeSpaceId, setHomeSpaceId] = useState<string | null>(null);
  const spaces = useQuery(spacesQuery);
  const units = useQuery(unitsQuery);
  // Familles des tags : feuille de filtres, ordre sur les cartes, filtre hors ligne [D216].
  const catalog = useQuery(tagCatalogQuery(spaceId));
  const [search, setSearch] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [baseOnly, setBaseOnly] = useState(false);
  // Ordre de la liste [D217] : retenu sur l'appareil.
  const [sort, setSortState] = useState(readRecipeSort);
  const setSort = (next: RecipeSort) => {
    setSortState(next);
    writeRecipeSort(next);
  };
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [addStep, setAddStep] = useState<AddStep | null>(null);
  const [importSheet, setImportSheet] = useState<ImportSheet>(null);
  const [actionsFor, setActionsFor] = useState<{ spaceId: string; recipe: RecipeSummary }>();
  // Filtre par ingredient ouvert depuis la recherche globale (?ingredient=, nom dans l'etat).
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const ingredientId = params.get("ingredient");
  const ingredientName =
    (location.state as { ingredientName?: string } | null)?.ingredientName ?? "Ingrédient";
  const clearIngredient = () => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("ingredient");
        return next;
      },
      { replace: true }
    );
  };
  // Tag choisi dans la recherche globale (?tag=) [D216] : devient un filtre actif,
  // une fois par arrivee, puis l'adresse est nettoyee.
  const tagParam = params.get("tag");
  const [seenTag, setSeenTag] = useState<string | null>(null);
  if (tagParam !== seenTag) {
    setSeenTag(tagParam);
    if (tagParam) setTagIds([tagParam]);
  }
  useEffect(() => {
    if (!tagParam) return;
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("tag");
        return next;
      },
      { replace: true }
    );
  }, [tagParam, setParams]);
  const q = useDebounced(search.trim());
  const online = useOnline();
  const guard = useWriteGuard();
  const queryClient = useQueryClient();
  const me = useQuery(meQuery);
  const list = useInfiniteQuery({
    ...recipesQuery(spaceId, {
      q,
      tagIds,
      ingredientIds: ingredientId ? [ingredientId] : [],
      base: baseOnly,
      sort,
      mine,
      homeSpaceId,
    }),
    // La nature de l'espace choisit la liste (perso : "Mes recettes").
    enabled: space.data !== undefined,
    // Pendant une recherche, la liste precedente reste affichee (pas de clignotement).
    placeholderData: keepPreviousData,
  });

  const spaceName = space.data?.name ?? "";
  const filtered =
    q !== "" || tagIds.length > 0 || baseOnly || ingredientId !== null || homeSpaceId !== null;
  // Espaces ou je peux avoir des recettes : perso d'abord, puis les groupes actifs.
  const homeChoices = mine
    ? [...(spaces.data ?? [])]
        .filter((s) => s.deletedAt === null)
        .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "PERSONAL" ? -1 : 1))
    : [];
  const recipes = list.data?.pages.flatMap((page) => page.data) ?? [];
  const tagsOf = (recipe: RecipeSummary) =>
    sortByFamily(recipe.tags, catalog.data).map((tag) => tag.name);
  const tagName = (id: string) => catalog.data?.tags.find((tag) => tag.id === id)?.name ?? "Tag";
  const clearFilters = () => {
    setTagIds([]);
    setBaseOnly(false);
    setHomeSpaceId(null);
    setSort(DEFAULT_RECIPE_SORT);
    clearIngredient();
  };
  const homeSpace = homeChoices.find((choice) => choice.id === homeSpaceId);
  const active: ActiveFilter[] = [
    ...(ingredientId
      ? [{ key: "ingredient", label: `Avec ${ingredientName}`, onRemove: clearIngredient }]
      : []),
    ...(homeSpace
      ? [{ key: "home", label: homeLabel(homeSpace), onRemove: () => setHomeSpaceId(null) }]
      : []),
    ...tagIds.map((id) => ({
      key: id,
      label: tagName(id),
      onRemove: () => {
        setTagIds((ids) => ids.filter((other) => other !== id));
      },
    })),
    ...(baseOnly ? [{ key: "base", label: "Bases", onRemove: () => setBaseOnly(false) }] : []),
    ...(sort === DEFAULT_RECIPE_SORT
      ? []
      : [
          {
            key: "sort",
            label: `Tri : ${RECIPE_SORT_LABELS[sort]}`,
            onRemove: () => {
              setSort(DEFAULT_RECIPE_SORT);
            },
          },
        ]),
  ];
  // "Mes recettes" ouvre chaque recette dans son espace d'origine.
  const open = (recipe: RecipeSummary) => {
    void navigate(`/s/${mine ? recipe.homeSpaceId : spaceId}/recipes/${recipe.id}`);
  };
  const group = space.data?.kind === "GROUP";
  // Recherche globale : "Ajouter mes recettes" ouvre la selection (`?addMine=1`).
  const [mineFlag, setMineFlag] = useUrlFlag("addMine", space.data ? group : undefined);
  const addLabel = group ? "Ajouter une recette" : "Nouvelle recette";
  const add = () => {
    setAddStep(group ? "root" : "create");
  };
  const showActions = (recipe: RecipeSummary) => {
    setActionsFor({ spaceId: mine ? recipe.homeSpaceId : spaceId, recipe });
  };

  let content;
  // Espace sans aucune recette : ni recherche ni filtres, seulement l'invitation a en ajouter (R8).
  let emptySpace = false;
  if (!online) {
    const term = normalizeName(q);
    const available = offlineRecipes(queryClient, spaceId, mine, me.data?.id);
    const shown = sortRecipes(
      available.map(({ recipe }) => recipe),
      sort
    )
      .map(toSummary)
      .filter(
        (recipe) =>
          (!term || normalizeName(recipe.title).includes(term)) &&
          (!baseOnly || recipe.isBase) &&
          matchesTagFilter(
            recipe.tags.map((tag) => tag.id),
            tagIds,
            (id) => catalog.data?.tags.find((tag) => tag.id === id)?.familyId ?? null
          )
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
            recipes={shown}
            units={units.data ?? []}
            badges={(recipe) => [
              ...badgesOf(recipe, spaceId, mine, spaces.data ?? []),
              { label: "Hors ligne", tone: "warning" },
            ]}
            tags={tagsOf}
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
              clearFilters();
            }}
          >
            Effacer les filtres
          </Button>
        }
      />
    );
  } else if (recipes.length === 0) {
    emptySpace = true;
    content = (
      <EmptyState
        icon="book-open"
        title={mine ? "Pas encore de recette à toi" : `Pas encore de recette dans ${spaceName}`}
        action={
          <Button icon="plus" onClick={add}>
            {addLabel}
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
          tags={tagsOf}
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
          {addLabel}
        </Button>
      </div>
      {mine || space.data?.kind === "GROUP" ? (
        <>
          <ShareRequestsBanner spaceId={spaceId} />
          <SuggestionsToDecideBanner spaceId={spaceId} />
        </>
      ) : null}
      {emptySpace ? null : (
        <>
          <div className="flex items-center gap-2">
            <input
              type="search"
              className="fm-input min-w-0 flex-1"
              aria-label="Rechercher une recette"
              placeholder="Rechercher une recette"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
              }}
            />
            <FiltersButton
              count={active.length}
              onClick={() => {
                setFiltersOpen(true);
              }}
            />
          </div>
          <ActiveFilters filters={active} />
        </>
      )}
      {content}
      <FiltersSheet
        open={filtersOpen}
        onClose={() => {
          setFiltersOpen(false);
        }}
        catalog={catalog.data}
        spaceName={spaceName}
        // "Mes recettes" couvre plusieurs espaces : les nombres de l'espace perso seraient faux.
        counts={!mine}
        tagIds={tagIds}
        onTagIds={setTagIds}
        baseOnly={baseOnly}
        onBaseOnly={setBaseOnly}
        homeChoices={homeChoices}
        homeSpaceId={homeSpaceId}
        onHomeSpaceId={setHomeSpaceId}
        sort={sort}
        onSort={setSort}
        total={online ? list.data?.pages[0]?.total : undefined}
        onClear={clearFilters}
      />
      <AddRecipeSheet
        step={addStep === "root" || addStep === "create" ? addStep : null}
        onStep={setAddStep}
        onClose={() => {
          setAddStep(null);
        }}
        onImport={(sheet) => {
          setAddStep(null);
          setImportSheet(sheet);
        }}
        spaceId={spaceId}
        spaceName={spaceName}
        group={group}
      />
      {group ? (
        <AddMineSheet
          open={addStep === "mine" || mineFlag}
          onClose={() => {
            setMineFlag(false);
            setAddStep(null);
          }}
          onBack={() => {
            setMineFlag(false);
            setAddStep("root");
          }}
          onCreate={() => {
            setMineFlag(false);
            setAddStep("create");
          }}
          spaceId={spaceId}
          spaceName={spaceName}
        />
      ) : null}
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
