// F-MES-RECETTES (C7c.1) : depuis un espace de groupe, cocher ses recettes nees
// ailleurs et les y partager d'un coup, par reference ; les sous-recettes qui
// suivent sont annoncees avant d'ajouter ; tout ou rien [D203, D208, D26].
import {
  ADD_MINE_MAX,
  addMinePreviewSchema,
  addMineResultSchema,
  type AddMinePreview,
  type RecipeSummary,
} from "@fm/shared";
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";

import { FormAlert } from "../../core/access/auth-layout.tsx";
import { spacesQuery } from "../../core/session/queries.ts";
import { errorMessage } from "../../i18n/index.ts";
import { api, ApiRequestError } from "../../lib/api.ts";
import { useDebounced } from "../../lib/use-debounced.ts";
import { Button, IconButton } from "../../ui/button.tsx";
import { Chip } from "../../ui/controls.tsx";
import { EmptyState, Skeleton } from "../../ui/display.tsx";
import { Sheet, SheetFooter } from "../../ui/sheet.tsx";
import { useToast } from "../../ui/use-toast.ts";
import { recipeMeta } from "./format.ts";
import { globalTagsQuery, recipesKey, recipesQuery, unitsQuery } from "./queries.ts";

const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);

const STALE_SELECTION =
  "Une recette n'est plus disponible : la liste est à jour, vérifie ta sélection.";

export function AddMineSheet({
  open,
  onClose,
  onBack,
  onCreate,
  spaceId,
  spaceName,
}: {
  open: boolean;
  onClose: () => void;
  /** Retour a la feuille "Ajouter une recette". */
  onBack: () => void;
  /** Etat vide : "Creer" ouvre le sous-menu de creation. */
  onCreate: () => void;
  spaceId: string;
  spaceName: string;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  // Selection dans l'ordre des clics : l'ajout et l'activite gardent cet ordre.
  const [selected, setSelected] = useState<RecipeSummary[]>([]);
  const [withIt, setWithIt] = useState<AddMinePreview["withIt"] | null>(null);
  const [alert, setAlert] = useState<string>();
  const q = useDebounced(search.trim());
  const filtered = q !== "" || tagIds.length > 0;

  const list = useInfiniteQuery({
    ...recipesQuery(spaceId, { mine: true, addable: true, q, tagIds }),
    enabled: open,
    placeholderData: keepPreviousData,
  });
  const recipes = list.data?.pages.flatMap((page) => page.data) ?? [];
  // Liste vide sans filtre : "deja toutes ici" ou "pas encore de recette".
  const anyMine = useInfiniteQuery({
    ...recipesQuery(spaceId, { mine: true }),
    enabled: open && list.isSuccess && recipes.length === 0 && !filtered,
  });
  const hasRecipes = (anyMine.data?.pages[0]?.data.length ?? 1) > 0;
  const units = useQuery(unitsQuery);
  const spaces = useQuery(spacesQuery);
  const tags = useQuery(globalTagsQuery);

  const reset = () => {
    setSearch("");
    setTagIds([]);
    setSelected([]);
    setWithIt(null);
    setAlert(undefined);
  };
  const close = () => {
    reset();
    onClose();
  };
  const ids = selected.map((recipe) => recipe.id);

  /** Refus tout ou rien : la liste est relue et la selection garde ce qui reste. */
  const onRefused = async (error: unknown) => {
    setWithIt(null);
    if (!(error instanceof ApiRequestError) || error.code !== "RECIPE_001") {
      setAlert(errorMessage(error));
      return;
    }
    setAlert(STALE_SELECTION);
    const fresh = await list.refetch();
    const still = new Set(fresh.data?.pages.flatMap((page) => page.data.map((r) => r.id)) ?? []);
    setSelected((current) => current.filter((recipe) => still.has(recipe.id)));
  };

  const add = useMutation({
    mutationFn: () =>
      api.post(`/spaces/${spaceId}/recipes/add-mine`, { recipeIds: ids }, addMineResultSchema),
    onSuccess: async ({ added }) => {
      const [first] = selected;
      await queryClient.invalidateQueries({ queryKey: recipesKey(spaceId) });
      toast(
        added === 1 && selected.length === 1 && first
          ? `${first.title} ajoutée à ${spaceName}`
          : added === 0
            ? `Déjà dans ${spaceName}`
            : `${String(added)} ${plural(added, "recette ajoutée", "recettes ajoutées")} à ${spaceName}`,
        { tone: "success" }
      );
      close();
    },
    onError: onRefused,
  });
  const preview = useMutation({
    mutationFn: () =>
      api.post(
        `/spaces/${spaceId}/recipes/add-mine/preview`,
        { recipeIds: ids },
        addMinePreviewSchema
      ),
    onSuccess: (result) => {
      if (result.withIt.length > 0) setWithIt(result.withIt);
      else add.mutate();
    },
    onError: onRefused,
  });
  const busy = add.isPending || preview.isPending;
  const n = selected.length;
  const count = `${String(n)} ${plural(n, "recette", "recettes")}`;

  if (withIt) {
    const arriving = withIt.filter((sub) => sub.included);
    const staying = withIt.filter((sub) => !sub.included);
    return (
      <Sheet open={open} onClose={close} title={`Ajouter ${count} à ${spaceName}`}>
        <div className="fm-stack">
          {arriving.length > 0 ? (
            <section className="fm-stack">
              <h3 className="m-0 text-sm font-semibold text-ink-muted">Arrivent avec</h3>
              <ul className="fm-stack m-0 list-none p-0" aria-label="Arrivent avec">
                {arriving.map((sub) => (
                  <li key={sub.id}>{sub.title}</li>
                ))}
              </ul>
            </section>
          ) : null}
          {staying.length > 0 ? (
            <section className="fm-stack">
              <h3 className="m-0 text-sm font-semibold text-ink-muted">Restent dans leur espace</h3>
              <ul className="fm-stack m-0 list-none p-0" aria-label="Restent dans leur espace">
                {staying.map((sub) => (
                  <li key={sub.id}>
                    {sub.title}
                    <small className="block text-ink-muted">
                      Recette d'un autre membre : « non disponible » dans {spaceName}.
                    </small>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <small className="text-ink-muted">
            Ce sont les mêmes recettes, pas des copies : une modification se voit dans tous tes
            espaces.
          </small>
          <SheetFooter>
            <div className="grid grid-cols-[auto_1fr] gap-2">
              <Button
                onClick={() => {
                  setWithIt(null);
                }}
              >
                Retour
              </Button>
              <Button variant="primary" disabled={busy} onClick={() => add.mutate()}>
                Ajouter
              </Button>
            </div>
          </SheetFooter>
        </div>
      </Sheet>
    );
  }

  let content;
  if (list.isError && !list.data) {
    content = <FormAlert message={errorMessage(list.error)} />;
  } else if (!list.data || !units.data) {
    content = <Skeleton kind="row" count={4} label="Chargement de tes recettes…" />;
  } else if (recipes.length === 0) {
    content = filtered ? (
      <EmptyState icon="search" title="Aucune recette ne correspond" />
    ) : (
      <EmptyState
        title={
          hasRecipes
            ? `Toutes tes recettes sont déjà dans ${spaceName}`
            : "Tu n'as pas encore de recette"
        }
        action={
          <Button variant="primary" icon="plus" onClick={onCreate}>
            Créer
          </Button>
        }
      >
        Crée-en une nouvelle : elle sera visible ici tout de suite.
      </EmptyState>
    );
  } else {
    const full = n >= ADD_MINE_MAX;
    content = (
      <ul className="fm-pick-list">
        {recipes.map((recipe) => {
          const checked = ids.includes(recipe.id);
          const home = spaces.data?.find((space) => space.id === recipe.homeSpaceId);
          const origin = home?.kind === "PERSONAL" ? "Perso" : home?.name;
          return (
            <li key={recipe.id}>
              <label className="fm-pick">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!checked && full}
                  onChange={(event) => {
                    const on = event.target.checked;
                    setSelected((current) =>
                      on ? [...current, recipe] : current.filter((r) => r.id !== recipe.id)
                    );
                  }}
                />
                <span className="fm-pick-text">
                  <b>{recipe.title}</b>
                  <small>
                    {[origin, recipeMeta(recipe, units.data)].filter(Boolean).join(" · ")}
                  </small>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <Sheet open={open} onClose={close} title="Mes recettes à ajouter">
      <div className="fm-stack">
        <div className="flex items-center gap-2">
          <IconButton
            icon="arrow-left"
            label="Retour"
            onClick={() => {
              reset();
              onBack();
            }}
          />
          <input
            type="search"
            className="fm-input flex-1"
            aria-label="Rechercher"
            placeholder="Rechercher"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
            }}
          />
        </div>
        {(tags.data ?? []).length > 0 ? (
          <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Tags">
            <Chip
              selected={tagIds.length === 0}
              onToggle={() => {
                setTagIds([]);
              }}
            >
              Toutes
            </Chip>
            {(tags.data ?? []).map((tag) => (
              <Chip
                key={tag.id}
                selected={tagIds.includes(tag.id)}
                onToggle={(on) => {
                  setTagIds((current) =>
                    on ? [...current, tag.id] : current.filter((id) => id !== tag.id)
                  );
                }}
              >
                {tag.name}
              </Chip>
            ))}
          </div>
        ) : null}
        {content}
        {list.hasNextPage ? (
          <Button
            className="self-center"
            disabled={list.isFetchingNextPage}
            onClick={() => void list.fetchNextPage()}
          >
            Voir plus
          </Button>
        ) : null}
        <FormAlert message={alert} />
        <SheetFooter>
          <div className="fm-stack fm-pick-foot">
            <div className="fm-pick-count">
              <span>
                {n === 0 ? "Aucune choisie" : `${String(n)} ${plural(n, "choisie", "choisies")}`}
              </span>
              <span>{ADD_MINE_MAX} max</span>
            </div>
            <Button
              variant="primary"
              block
              disabled={n === 0 || busy}
              onClick={() => {
                setAlert(undefined);
                preview.mutate();
              }}
            >
              {n === 0 ? "Choisis au moins une recette" : `Ajouter ${count}`}
            </Button>
          </div>
        </SheetFooter>
      </div>
    </Sheet>
  );
}
