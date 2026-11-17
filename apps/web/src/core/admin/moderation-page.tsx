// Vue de moderation d'un espace [D52, D122, D178] : lecture seule pendant la
// duree de l'acces ; seules les actions de moderation sont possibles (masquer,
// reafficher, retirer d'un espace de partage, supprimer une recette ou l'espace),
// chacune avec un motif enregistre dans le journal d'audit.
import {
  MODERATION_NOTE_MAX,
  moderationSpaceSchema,
  recipeSchema,
  type AdminUnit,
  type ModerationRecipeItem,
  type ModerationSpace,
  type Recipe,
  type Unit,
} from "@fm/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { errorMessage } from "../../i18n/index.ts";
import { ApiRequestError, api } from "../../lib/api.ts";
import { BlockBody } from "../../modules/recipes/recipe-page.tsx";
import { Button } from "../../ui/button.tsx";
import { Badge, Skeleton } from "../../ui/display.tsx";
import { Field } from "../../ui/field.tsx";
import { Sheet, SheetFooter } from "../../ui/sheet.tsx";
import { useToast } from "../../ui/use-toast.ts";
import { FormAlert } from "../access/auth-layout.tsx";
import { REASON_LABELS } from "./format.ts";
import { minutesLeft } from "./queries.ts";
import { adminUnitsQuery } from "./referential-queries.ts";

type Action = "hide" | "remove" | "delete" | "delete-space";

/** Unites admin vues comme celles des membres (affichage des quantites). */
function asUnits(units: AdminUnit[]): Unit[] {
  return units.map((u) => ({
    id: u.id,
    code: u.code,
    dimension: u.dimension,
    toBase: u.toBase,
    metric: u.metric,
    name: u.fr.name,
    namePlural: u.fr.namePlural,
    abbreviation: u.fr.abbreviation,
  }));
}

function ActionSheet({
  spaceId,
  spaceName,
  action,
  recipe,
  onClose,
  onDone,
}: {
  spaceId: string;
  spaceName: string;
  action: Action | null;
  recipe: ModerationRecipeItem | null;
  onClose: () => void;
  onDone: (action: Action) => void;
}) {
  const [note, setNote] = useState("");
  const [missing, setMissing] = useState(false);
  const title = recipe?.title ?? "";
  const texts: Record<Action, { title: string; submit: string; help: string }> = {
    hide: {
      title: `Masquer « ${title} »`,
      submit: "Masquer",
      help: "Elle disparaît pour tous les membres ; son auteur la voit encore, avec ce motif.",
    },
    remove: {
      title: `Retirer « ${title} » de ${spaceName}`,
      submit: "Retirer",
      help: "Elle n'est plus partagée dans cet espace. Elle reste chez son auteur.",
    },
    delete: {
      title: `Supprimer « ${title} » ?`,
      submit: "Supprimer",
      help: "Elle disparaît de tous les espaces où elle est visible.",
    },
    "delete-space": {
      title: `Supprimer l'espace ${spaceName} ?`,
      submit: "Supprimer l'espace",
      help: "L'espace est masqué pour ses membres, restaurable 30 jours, puis purgé.",
    },
  };
  const text = action ? texts[action] : null;
  const run = useMutation({
    mutationFn: (current: Action) =>
      api.post(
        current === "delete-space"
          ? `/admin/moderation/${spaceId}/delete-space`
          : `/admin/moderation/${spaceId}/recipes/${recipe?.id ?? ""}/${current}`,
        { note: note.trim() }
      ),
    onSuccess: (_data, current) => {
      setNote("");
      setMissing(false);
      onDone(current);
    },
  });
  return (
    <Sheet open={action !== null} onClose={onClose} title={text?.title ?? ""}>
      <form
        className="fm-stack"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!note.trim()) {
            setMissing(true);
            return;
          }
          if (action) run.mutate(action);
        }}
      >
        <FormAlert message={run.error ? errorMessage(run.error) : undefined} />
        <p className="m-0 text-ink-muted">{text?.help}</p>
        <Field
          label="Motif"
          multiline
          rows={3}
          maxLength={MODERATION_NOTE_MAX}
          hint="Obligatoire. Enregistré dans le journal d'audit."
          error={missing && !note.trim() ? "Le motif est obligatoire." : undefined}
          value={note}
          onChange={(event) => {
            setNote(event.target.value);
          }}
        />
        <SheetFooter>
          <Button type="button" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" variant="danger" disabled={run.isPending}>
            {text?.submit ?? ""}
          </Button>
        </SheetFooter>
      </form>
    </Sheet>
  );
}

function RecipeDetail({
  spaceId,
  item,
  onAction,
  onUnhide,
}: {
  spaceId: string;
  item: ModerationRecipeItem;
  onAction: (action: Action) => void;
  onUnhide: () => void;
}) {
  const recipe = useQuery({
    queryKey: ["admin", "moderation", spaceId, "recipes", item.id],
    queryFn: () => api.get(`/admin/moderation/${spaceId}/recipes/${item.id}`, recipeSchema),
  });
  const units = useQuery(adminUnitsQuery);
  const titleId = `moderation-recipe-${item.id}`;
  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-[1_1_460px] flex-col gap-4 self-start rounded-lg border border-line bg-surface-raised p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id={titleId} className="m-0 font-display text-xl font-bold">
          {item.title}
        </h2>
        <span className="text-sm text-ink-muted">
          par {item.author}
          {item.atHome ? "" : " · partagée dans cet espace"}
          {recipe.data ? ` · révision ${String(recipe.data.currentRevision)}` : ""}
        </span>
      </div>
      {item.hiddenReason !== null ? (
        <p className="m-0 rounded-md bg-warning-soft px-4 py-3 text-sm">
          <b>Masquée</b> : {item.hiddenReason}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {item.hiddenReason === null ? (
          <Button
            size="sm"
            onClick={() => {
              onAction("hide");
            }}
          >
            Masquer…
          </Button>
        ) : (
          <Button size="sm" onClick={onUnhide}>
            Réafficher
          </Button>
        )}
        {item.atHome ? null : (
          <Button
            size="sm"
            onClick={() => {
              onAction("remove");
            }}
          >
            Retirer de cet espace…
          </Button>
        )}
        <Button
          size="sm"
          variant="danger"
          onClick={() => {
            onAction("delete");
          }}
        >
          Supprimer…
        </Button>
      </div>
      {recipe.isError ? (
        <FormAlert message={errorMessage(recipe.error)} />
      ) : !recipe.data || !units.data ? (
        <Skeleton label="Chargement de la recette" />
      ) : (
        <ReadOnlyRecipe recipe={recipe.data} units={asUnits(units.data)} />
      )}
    </section>
  );
}

function ReadOnlyRecipe({ recipe, units }: { recipe: Recipe; units: Unit[] }) {
  return (
    <div className="fm-stack">
      {recipe.description ? <p className="m-0">{recipe.description}</p> : null}
      {recipe.blocks.map((block, index) =>
        block.kind === "LOCAL" ? (
          <section
            key={index}
            className="fm-block"
            aria-label={block.title ?? `Bloc ${String(index + 1)}`}
          >
            <div className="fm-block-head">
              <b>{block.title ?? "Ingrédients et étapes"}</b>
            </div>
            <BlockBody block={block} units={units} scale={1} />
          </section>
        ) : (
          <p key={index} className="m-0 text-sm text-ink-muted">
            Recette liée : {block.recipe?.title ?? "non visible ici"}
          </p>
        )
      )}
      {recipe.notes ? <p className="m-0 whitespace-pre-line">{recipe.notes}</p> : null}
    </div>
  );
}

function ModerationView({ view }: { view: ModerationSpace }) {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { space, access, recipes } = view;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 15_000);
    return () => {
      window.clearInterval(timer);
    };
  }, []);
  const selected = recipes.find((r) => r.id === selectedId) ?? null;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin", "moderation"] });
  const close = useMutation({
    mutationFn: () => api.post(`/admin/moderation/${space.id}/close`),
    onSettled: () => {
      void navigate("/admin/spaces");
    },
  });
  const unhide = useMutation({
    mutationFn: (recipeId: string) =>
      api.post(`/admin/moderation/${space.id}/recipes/${recipeId}/unhide`),
    onSuccess: async () => {
      toast("Recette réaffichée", { tone: "success" });
      await refresh();
    },
  });
  const done = async (current: Action) => {
    setAction(null);
    if (current === "delete-space") {
      toast(`${space.name} supprimé`, { tone: "success" });
      await queryClient.invalidateQueries({ queryKey: ["admin", "spaces"] });
      void navigate("/admin/spaces");
      return;
    }
    toast(
      current === "hide"
        ? "Recette masquée"
        : current === "remove"
          ? "Recette retirée"
          : "Recette supprimée",
      { tone: "success" }
    );
    if (current !== "hide") setSelectedId(null);
    await refresh();
  };
  return (
    <>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-[1_1_360px] flex-col gap-1">
          <h1 className="m-0 font-display text-2xl font-bold">Modération : {space.name}</h1>
          <p className="m-0 text-ink-muted">
            OWNER {space.owner ?? "-"} · {space.memberCount} membres · {space.recipeCount} recettes
          </p>
        </div>
        <Button
          icon="lock"
          disabled={close.isPending}
          onClick={() => {
            close.mutate();
          }}
        >
          Fermer l&apos;accès
        </Button>
      </div>
      <div
        role="status"
        className="flex flex-col gap-1 rounded-md bg-accent-soft px-4 py-3 text-sm"
      >
        <b>Lecture seule, encore {minutesLeft(access.expiresAt, now)} min.</b>
        <span>
          Motif : {REASON_LABELS[access.reason]}, « {access.note} ». Chaque action est enregistrée
          dans le journal d&apos;audit.
        </span>
      </div>
      <div className="flex flex-wrap items-start gap-5">
        <section
          aria-label="Recettes de l'espace"
          className="flex min-w-0 flex-[1_1_340px] flex-col gap-3"
        >
          {recipes.length === 0 ? (
            <p className="m-0 text-ink-muted">Aucune recette dans cet espace.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col overflow-hidden rounded-lg border border-line bg-surface-raised p-0">
              {recipes.map((recipe) => (
                <li key={recipe.id} className="border-b border-line last:border-b-0">
                  <button
                    type="button"
                    aria-pressed={recipe.id === selectedId}
                    className={`flex min-h-14 w-full items-center gap-2.5 px-4 py-3 text-left ${
                      recipe.id === selectedId ? "bg-accent-soft" : "hover:bg-surface"
                    }`}
                    onClick={() => {
                      setSelectedId(recipe.id);
                    }}
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <b>{recipe.title}</b>
                      <span className="text-sm text-ink-muted">par {recipe.author}</span>
                    </span>
                    {recipe.atHome ? null : <Badge>Partagée ici</Badge>}
                    {recipe.hiddenReason !== null ? <Badge tone="warning">Masquée</Badge> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {space.kind === "GROUP" ? (
            <Button
              variant="ghost"
              icon="trash"
              onClick={() => {
                setAction("delete-space");
              }}
            >
              Supprimer l&apos;espace…
            </Button>
          ) : null}
        </section>
        {selected ? (
          <RecipeDetail
            key={selected.id}
            spaceId={space.id}
            item={selected}
            onAction={setAction}
            onUnhide={() => {
              unhide.mutate(selected.id);
            }}
          />
        ) : (
          <p className="m-0 flex-[1_1_460px] self-center text-center text-ink-muted">
            Choisis une recette pour la lire.
          </p>
        )}
      </div>
      <ActionSheet
        spaceId={space.id}
        spaceName={space.name}
        action={action}
        recipe={selected}
        onClose={() => {
          setAction(null);
        }}
        onDone={(current) => void done(current)}
      />
    </>
  );
}

export function ModerationPage() {
  const { spaceId = "" } = useParams();
  const view = useQuery({
    queryKey: ["admin", "moderation", spaceId],
    queryFn: () => api.get(`/admin/moderation/${spaceId}`, moderationSpaceSchema),
    retry: false,
  });
  if (view.isPending) return <Skeleton label="Chargement de l'espace" />;
  if (view.isError) {
    const denied = view.error instanceof ApiRequestError && view.error.code === "ADMIN_013";
    return (
      <div className="flex flex-col items-start gap-3">
        <h1 className="m-0 font-display text-2xl font-bold">Modération</h1>
        <FormAlert message={errorMessage(view.error)} />
        {denied ? (
          <p className="m-0 text-ink-muted">L&apos;accès a expiré ou n&apos;a pas été ouvert.</p>
        ) : null}
        <Link to="/admin/spaces" className="fm-btn fm-btn-secondary no-underline">
          Revenir aux espaces
        </Link>
      </div>
    );
  }
  return <ModerationView view={view.data} />;
}
