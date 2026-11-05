// E-RECETTES : recettes de l'espace (F-REC-11) avec recherche, filtres par tag,
// "Bases" et "Mes recettes" ; etats vide, chargement, erreur ; F-AJOUT-RECETTE.
import type { RecipeSummary, Unit } from "@fm/shared";
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { meQuery, spaceQuery } from "../../core/session/queries.ts";
import { errorMessage } from "../../i18n/index.ts";
import { Button } from "../../ui/button.tsx";
import { Chip } from "../../ui/controls.tsx";
import { EmptyState, Skeleton } from "../../ui/display.tsx";
import { Icon, type IconName } from "../../ui/icon.tsx";
import { Sheet } from "../../ui/sheet.tsx";
import { RecipeCard, type CardBadge } from "./components/recipe-card.tsx";
import { recipeMeta } from "./format.ts";
import { globalTagsQuery, recipesQuery, spaceTagsQuery, unitsQuery } from "./queries.ts";

function badgesOf(recipe: RecipeSummary): CardBadge[] {
  const badges: CardBadge[] = [];
  if (recipe.isComposed) badges.push({ label: "Composée", tone: "second", icon: "link" });
  if (recipe.isBase) badges.push({ label: "Base", tone: "second" });
  return badges;
}

function AddRecipeSheet({
  open,
  onClose,
  spaceId,
  spaceName,
}: {
  open: boolean;
  onClose: () => void;
  spaceId: string;
  spaceName: string;
}) {
  const choices: { to?: string; icon: IconName; title: string; text: string }[] = [
    {
      to: `/s/${spaceId}/recipes/new`,
      icon: "pencil",
      title: "Saisir",
      text: "Écrire la recette toi-même",
    },
    { icon: "link", title: "Importer un lien", text: "Une page de recette sur le web (bientôt)" },
    { icon: "book-open", title: "Coller un texte", text: "Depuis un mail, une note (bientôt)" },
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
            <div key={choice.title} className="fm-option opacity-60" aria-disabled="true">
              {content}
            </div>
          );
        })}
        <small className="text-ink-muted">
          Dans tous les cas, tu vérifies tout dans l'éditeur avant d'enregistrer.
        </small>
      </div>
    </Sheet>
  );
}

function useDebounced(value: string, delay = 250): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value);
    }, delay);
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);
  return debounced;
}

function RecipeGrid({
  recipes,
  units,
  onOpen,
}: {
  recipes: readonly RecipeSummary[];
  units: readonly Unit[];
  onOpen: (id: string) => void;
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
            badges={badgesOf(recipe)}
            onOpen={() => {
              onOpen(recipe.id);
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
  const me = useQuery(meQuery);
  const units = useQuery(unitsQuery);
  const globalTags = useQuery(globalTagsQuery);
  const spaceTags = useQuery(spaceTagsQuery(spaceId));
  const [search, setSearch] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [baseOnly, setBaseOnly] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const q = useDebounced(search.trim());
  const authorId = mine ? me.data?.id : undefined;
  const list = useInfiniteQuery({
    ...recipesQuery(spaceId, { q, tagIds, base: baseOnly, authorId }),
    enabled: !mine || authorId !== undefined,
    // Pendant une recherche, la liste precedente reste affichee (pas de clignotement).
    placeholderData: keepPreviousData,
  });

  const spaceName = space.data?.name ?? "";
  const filtered = q !== "" || tagIds.length > 0 || baseOnly;
  const recipes = list.data?.pages.flatMap((page) => page.data) ?? [];
  const tags = [...(globalTags.data ?? []), ...(spaceTags.data ?? [])];
  const open = (id: string) => {
    void navigate(`/s/${spaceId}/recipes/${id}`);
  };
  const add = () => {
    setAddOpen(true);
  };

  let content;
  if (list.isError) {
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
          ? `Ajoute une recette : les ${space.data.memberCount} membres la verront ici.`
          : "Ajoute ta première recette : elle reste privée tant que tu ne la partages pas."}
      </EmptyState>
    );
  } else {
    content = (
      <>
        <RecipeGrid recipes={recipes} units={units.data} onOpen={open} />
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
        <Button variant="primary" icon="plus" className="flex-1 md:flex-none" onClick={add}>
          Nouvelle recette
        </Button>
      </div>
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
        spaceId={spaceId}
        spaceName={spaceName}
      />
    </div>
  );
}
